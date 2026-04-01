import { NextResponse } from "next/server";
import { ProjectMilestoneStatus, ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

const milestoneSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  deadline: z.union([z.string().datetime(), z.literal(""), z.null(), z.undefined()]),
  status: z.nativeEnum(ProjectMilestoneStatus).default(ProjectMilestoneStatus.TODO),
  position: z.number().int().nonnegative().optional(),
});

const updateProjectSchema = z.object({
  customerId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  startDate: z.union([z.string().datetime(), z.literal(""), z.null(), z.undefined()]),
  deadline: z.union([z.string().datetime(), z.literal(""), z.null(), z.undefined()]),
  status: z.nativeEnum(ProjectStatus),
  progress: z.number().int().min(0).max(100),
  milestones: z.array(milestoneSchema).default([]),
});

function toNullableDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati progetto non validi" }, { status: 400 });
  }

  try {
    const project = await prisma.$transaction(async (tx) => {
      await tx.projectMilestone.deleteMany({ where: { projectId: id } });

      return tx.project.update({
        where: { id },
        data: {
          customerId: parsed.data.customerId || null,
          name: parsed.data.name,
          description: parsed.data.description || null,
          startDate: toNullableDate(parsed.data.startDate),
          deadline: toNullableDate(parsed.data.deadline),
          status: parsed.data.status,
          progress: parsed.data.progress,
          milestones: {
            create: parsed.data.milestones.map((milestone, index) => ({
              title: milestone.title,
              description: milestone.description || null,
              deadline: toNullableDate(milestone.deadline),
              status: milestone.status,
              position: milestone.position ?? index,
            })),
          },
        },
        include: {
          customer: true,
          milestones: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          },
        },
      });
    });

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Impossibile aggiornare progetto" }, { status: 409 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Progetto non trovato o non eliminabile" }, { status: 409 });
  }
}
