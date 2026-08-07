import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { JobPostingsService } from "../src/modules/job-postings/job-postings.service";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@dilg.gov.ph";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash("ChangeMe123!", 10),
      role: "ADMIN",
    },
  });

  const postedAt = new Date();
  const closingAt = JobPostingsService.computeClosingAt(postedAt);

  await prisma.jobPosting.createMany({
    data: [
      {
        title: "Local Government Operations Officer I (Entry Level)",
        positionLevel: "ENTRY",
        qualificationEducation: "Bachelor's degree relevant to the job",
        qualificationTraining: "4 hours of relevant training",
        qualificationExperience: "1 year of relevant experience",
        qualificationEligibility: "Career Service Professional / RA 1080",
        postedAt,
        closingAt,
        createdByUserId: admin.id,
      },
      {
        title: "Local Government Operations Officer III (Promotional)",
        positionLevel: "PROMOTIONAL",
        qualificationEducation: "Bachelor's degree relevant to the job",
        qualificationTraining: "16 hours of supervisory/management training",
        qualificationExperience: "3 years of supervisory/management experience",
        qualificationEligibility: "Career Service Professional / RA 1080",
        postedAt,
        closingAt,
        createdByUserId: admin.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`Seeded admin user (${adminEmail} / ChangeMe123!) and sample job postings.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
