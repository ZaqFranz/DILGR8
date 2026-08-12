// Official Philippine government Salary Grade schedule (Step 1, monthly,
// in PHP) under Executive Order No. 64, s. 2024 ("SSL VI"), Third Tranche,
// effective January 1, 2026 - DBM National Budget Circular No. 601. Cross-
// checked against two independent published copies of the same DBM table
// before use here.
//
// Job postings only ever quote the Step 1 (entry) rate - the RSP domain
// spec and the official posting document don't distinguish by step - so
// that's the only column encoded. EO 64 schedules a further tranche each
// January through 2027; when DBM issues the next one, update the values
// below (the shape/keys don't change) - see docs/decisions.md's
// 2026-08-12 "Fixed Monthly Salary derived from Salary Grade" entry.
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

// z.enum() needs a non-empty string-literal tuple, not a plain string[] -
// derived from the table's own keys so the two can never drift apart.
export const SALARY_GRADE_VALUES = Object.keys(SALARY_GRADE_MONTHLY_SALARY) as [string, ...string[]];

export function formatMonthlySalary(amount: number): string {
  return `₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
