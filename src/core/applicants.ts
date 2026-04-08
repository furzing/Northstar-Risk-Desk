import { config } from "./config";
import { titleize } from "./corpus";
import type { ApplicantProfile, RequestedProduct } from "./types";

export async function loadApplicants(): Promise<ApplicantProfile[]> {
  const applicants = (await Bun.file(config.applicantsPath).json()) as ApplicantProfile[];
  return [...applicants].sort((left, right) => left.businessName.localeCompare(right.businessName));
}

export async function getApplicant(applicantId: string): Promise<ApplicantProfile> {
  const applicants = await loadApplicants();
  const applicant = applicants.find((entry) => entry.id === applicantId);

  if (!applicant) {
    throw new Error(`Unknown applicant: ${applicantId}`);
  }

  return applicant;
}

export function humanizeRequestedProduct(product: RequestedProduct): string {
  switch (product) {
    case "working_capital_line":
      return "working capital line";
    case "invoice_advance":
      return "invoice advance";
    default:
      return titleize(product);
  }
}
