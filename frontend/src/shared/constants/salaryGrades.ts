// Mirrors backend/src/shared/constants/salaryGrades.ts (no shared package
// between workspaces - see docs/project-memory.md) - keep both in sync.
//
// Official Philippine government Salary Grade schedule (Step 1, monthly,
// in PHP) under Executive Order No. 64, s. 2024 ("SSL VI"), Third Tranche,
// effective January 1, 2026 - DBM National Budget Circular No. 601. Used
// here only to show a live preview as the admin picks a grade; the
// authoritative value is always computed server-side and returned on the
// saved posting - see docs/decisions.md's 2026-08-12 entry.
export const SALARY_GRADE_MONTHLY_SALARY: Record<string, number> = {
  "1": 14634,
  "2": 15522,
  "3": 16486,
  "4": 17506,
  "5": 18581,
  "6": 19716,
  "7": 20914,
  "8": 22423,
  "9": 24329,
  "10": 26917,
  "11": 31705,
  "12": 33947,
  "13": 36125,
  "14": 38764,
  "15": 42178,
  "16": 45694,
  "17": 49562,
  "18": 53818,
  "19": 59153,
  "20": 66052,
  "21": 73303,
  "22": 81796,
  "23": 91306,
  "24": 102603,
  "25": 116643,
  "26": 131807,
  "27": 148940,
  "28": 167129,
  "29": 187531,
  "30": 210718,
  "31": 300961,
  "32": 356237,
  "33": 449157,
};

export const SALARY_GRADE_OPTIONS = Object.keys(SALARY_GRADE_MONTHLY_SALARY);

export function formatMonthlySalary(amount: number): string {
  return `₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
