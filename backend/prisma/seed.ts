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
        description:
          "Assists in the implementation of local government programs, monitors compliance of LGUs with national policies, and provides technical assistance on local governance matters.",
        monthlySalary: "₱27,000.00",
        placeOfAssignment: "DILG Regional Office No. VIII, Government Center, Candahug, Palo, Leyte",
        positionLevel: "ENTRY",
        qualificationEducation: "Bachelor's degree relevant to the job",
        qualificationTraining: "4 hours of relevant training",
        qualificationExperience: "1 year of relevant experience",
        qualificationEligibility: "Career Service Professional / RA 1080",
        duties:
          "Assists in the implementation of local government programs\nMonitors compliance of LGUs with national policies\nProvides technical assistance on local governance matters\nPrepares field reports and monitoring documentation\nPerforms other duties as assigned",
        postedAt,
        closingAt,
        createdByUserId: admin.id,
      },
      {
        title: "Local Government Operations Officer III (Promotional)",
        description:
          "Supervises a team of LGOOs, reviews technical assistance reports, and represents the office in coordination meetings with local government units.",
        monthlySalary: "₱38,700.00",
        placeOfAssignment: "DILG Regional Office No. VIII, Government Center, Candahug, Palo, Leyte",
        positionLevel: "PROMOTIONAL",
        qualificationEducation: "Bachelor's degree relevant to the job",
        qualificationTraining: "16 hours of supervisory/management training",
        qualificationExperience: "3 years of supervisory/management experience",
        qualificationEligibility: "Career Service Professional / RA 1080",
        duties:
          "Supervises a team of LGOOs\nReviews technical assistance reports before submission\nRepresents the office in coordination meetings with local government units\nRecommends policy and program improvements based on field findings\nPerforms other duties as assigned",
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
