import { NextResponse } from "next/server";
import { ProjectMilestoneStatus, ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const milestoneSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  deadline: z.union([z.string().datetime(), z.literal(""), z.null(), z.undefined()]),
  status: z.nativeEnum(ProjectMilestoneStatus).default(ProjectMilestoneStatus.TODO),
  position: z.number().int().nonnegative().optional(),
});

const projectSchema = z.object({
  customerId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  startDate: z.union([z.string().datetime(), z.literal(""), z.null(), z.undefined()]),
  deadline: z.union([z.string().datetime(), z.literal(""), z.null(), z.undefined()]),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
  progress: z.number().int().min(0).max(100).default(0),
  milestones: z.array(milestoneSchema).default([]),
});

function toNullableDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      customer: true,
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = projectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati progetto non validi" }, { status: 400 });
  }

  try {
    const project = await prisma.project.create({
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

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Impossibile creare il progetto" }, { status: 409 });
  }
}
