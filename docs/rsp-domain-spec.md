# RSP Domain Spec (Source of Truth)

> Transcribed from the original project brief (`ClaudeCodeProje.docx`). This is the functional specification for the DILG Recruitment, Selection, and Placement (RSP) process. Implementation status per phase is tracked in [project-memory.md](./project-memory.md).

## Project Description: Recruitment, Selection, and Placement

### 1. Application Phase

Applicants shall send their application through the system (input all necessary info and upload all required documents).

**Required fields:**
- Demographic Profile
- Compliance to Qualification Standards (QS)
- Work Experience (inclusive periods, position/designation, agency)
- Learning and Development Interventions Attended
- Eligibility (Y/N)
  - If **Y**: checklist (RA1080, CSC Professional, CSC Sub-Professional, Barangay eligibility), then upload proof
  - If **N**: highlighted red (subject to manual validation)
- DILG Pre-Qualifying Examination — Passed → letter of invitation to evaluation of applicants
- Awards/Commendation
- IPCR (if promotional)
- Designation to a Higher Position (if promotional)

> Note: Sending of letters shall be subject to the input of the administrator re: schedule of PQE/Evaluation (with option to identify if dates are final).

### 2. Sifting

- Automatic sifting of qualified applicants.
- A table reflecting all qualified and non-qualified applicants (as sifted by GODDESS) appears on the admin side, with the option to validate applicants' qualification, and a button allowing admin to send the letter/notice to all qualified/non-qualified applicants.
- Criteria: education, trainings, experience, and eligibility.

### 3. Evaluation Forms

- Evaluation tools/forms added into the system for the boards' consumption.
- Input validation control: (1) mandatory fields completed before submitting; (2) prevent encoding of scores beyond the allowable threshold.
- Automatic computation of ratings (linked to tabulation and CompAss).
- Administrator can edit/update evaluation forms.

### 4. Tabulation (CompAss)

- Easy generation of matrix (ranked).
- Shortlisting — letter for shortlisted and those who are not.
- Letter (compliance to requirements).
- Letter (regrets).
- PSL and QME.

### 5. Learning and Development

**Preparation:**
- Option to upload POMS result.
- Automatic ranking of POMS result.
- Option to select which L&D intervention to add.
- L&D Plan with list of target pax per intervention.

**Conduct:**
- Recording.
- Attendance, Pre-, Post-.
- Certificate.
- EFF.
- PSL and QME.

### 6. PDC (Permit to Study / related)

- Permit to study.
- Manual input of requests.
- Monitoring database.
- Study load (uploading).
- Study Leave Applications.
- Authority to Engage in Limited Practice of Profession.

---

## Step-by-Step RSP Process

### 1. Application of Applicant
- Application should be submitted within 10 days from the date of posting.
- Prompt requiring applicant to identify whether the position applied for is promotional or entry level.
- Acceptance of application automatically ends at 11:59:59 PM of day 10.
- May apply for different positions at once.

### 2. Sifting
- Applicants should satisfy the qualification standards required by the position applied for.
- If the applicant satisfies the set QS, they receive a letter/notice of invitation to take the PQE. If not, they receive a letter/notice reflecting the reason why they cannot proceed.

### 3. Pre-Qualifying Examination (PQE)
- Qualified applicants who have not yet passed the PQE shall undergo the examination.
- PQE is conducted per batch (morning/noon/afternoon, maximum of 60 applicants), and may last several days depending on the number of applicants. Letter/notice to applicants shall reflect their specific schedule (e.g., January 9, 2025, 8:00 AM–10:30 AM).
- Once results are out, a letter/notice is sent to all examinees, regardless of pass/fail.

### 4. Evaluation
- Once the evaluation schedule is set, all qualified applicants are notified.
- Evaluation is scheduled for 2 days. If the number of applicants exceeds a 1:5 ratio (1 vacancy : 5 applicants), shortlisting is conducted after day 1. A letter/notice is disseminated for those invited to day 2 and those who will not proceed.
- All 13 members of the board are given access to the evaluation forms per battery test/activity.
- Results of the battery tests are reflected in the Comparative Assessment.

### 5. Deliberation
- After the Evaluation of Applicants, board members schedule a meeting for deliberation of Comparative Assessment ranking.
- Once approved by the PDC, the Comparative Assessment is recommended to the Regional Director.

### 6. Compliance to Requirements
- Once the RD has chosen applicants for appointment, a letter/notice requires applicants to comply with several documentary requirements, as mandated by CSC.
- Once all documents are complied with, a letter/notice inviting applicants to the oath-taking ceremony is sent.

### 7. Onboarding
- After oath-taking, newly hired personnel undergo the onboarding process. They are required to watch a series of videos and complete pre- and post-evaluations.
