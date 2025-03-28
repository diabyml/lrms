
---

**Specification Document: Laboratory Results Management System (LRMS) - MVP**

**Version:** 1.3
**Date:** 2023-10-27

**1. Introduction**

*   **Purpose:** To develop a web-based application allowing laboratories to manage patient test results efficiently.
*   **Goal (MVP):** Provide core functionality for a single laboratory to manage test types, doctors, patients, enter results associated with doctors, view patient results, and generate basic printable/downloadable reports.
*   **Target User:** Laboratory Staff / Technicians.
*   **Technology Stack:**
    *   Frontend: React.js
    *   UI Library: shadcn/ui
    *   Backend & Database: Supabase (Authentication, PostgreSQL Database, potentially Storage later)

**2. Core Entities & Data Model**

*   **User (Laboratory Staff):** Managed by Supabase Auth. Represents an individual logging into the system. Assumed to belong to a single implicit laboratory for the MVP.
*   **Patient:** Represents an individual whose tests are being processed.
    *   `id` (UUID, Primary Key)
    *   `patient_unique_id` (Text, Unique - e.g., MRN or lab-specific ID)
    *   `full_name` (Text, Not Null)
    *   `date_of_birth` (Date)
    *   `gender` (Text - e.g., 'Male', 'Female', 'Other', 'Prefer not to say')
    *   `phone` (Text, Nullable - Stores patient's phone number)
    *   `created_at` (Timestamp)
    *   `updated_at` (Timestamp)
*   **TestType:** Represents a category of test performed by the lab.
    *   `id` (UUID, Primary Key)
    *   `name` (Text, Not Null, Unique - e.g., "Complete Blood Count", "Lipid Panel")
    *   `created_at` (Timestamp)
    *   `updated_at` (Timestamp)
*   **TestParameter:** Represents a specific measurement within a TestType.
    *   `id` (UUID, Primary Key)
    *   `test_type_id` (UUID, Foreign Key to `TestType.id`)
    *   `name` (Text, Not Null - e.g., "Hemoglobin", "Cholesterol")
    *   `unit` (Text - e.g., "g/dL", "mg/dL")
    *   `reference_range` (Text - e.g., "13.5-17.5", "<200")
    *   `description` (Text, Nullable - Optional detailed explanation for the parameter or its range. Can contain plain text, HTML, or Markdown)
    *   `created_at` (Timestamp)
    *   `updated_at` (Timestamp)
*   **Doctor:** Represents a referring or ordering physician.
    *   `id` (UUID, Primary Key)
    *   `full_name` (Text, Not Null)
    *   `phone` (Text, Nullable)
    *   `hospital` (Text, Nullable - Name of the primary hospital/clinic)
    *   `bio` (Text, Nullable - Brief description or notes about the doctor)
    *   `created_at` (Timestamp)
    *   `updated_at` (Timestamp)
*   **PatientResult:** Represents a specific instance of testing performed for a patient, associated with a doctor.
    *   `id` (UUID, Primary Key)
    *   `patient_id` (UUID, Foreign Key to `Patient.id`, Not Null)
    *   `doctor_id` (UUID, Foreign Key to `Doctor.id`, Not Null - The doctor associated with this result)
    *   `result_date` (Timestamp, Not Null - When the result was finalized/reported)
    *   `created_at` (Timestamp)
    *   `updated_at` (Timestamp)
*   **ResultValue:** Stores the actual measured value for a specific parameter within a specific PatientResult.
    *   `id` (UUID, Primary Key)
    *   `patient_result_id` (UUID, Foreign Key to `PatientResult.id`)
    *   `test_parameter_id` (UUID, Foreign Key to `TestParameter.id`)
    *   `value` (Text, Not Null - Storing as text allows flexibility for numeric/non-numeric results)
    *   `created_at` (Timestamp)
    *   `updated_at` (Timestamp)

**Relationships:**

*   One `Patient` can have many `PatientResult` records.
*   One `TestType` can have many `TestParameter` records.
*   One `PatientResult` can contain values derived from multiple `TestType`s (implicitly via `ResultValue` linking back through `TestParameter` to `TestType`).
*   One `PatientResult` has many `ResultValue` records.
*   One `TestParameter` can be associated with many `ResultValue` records (across different `PatientResult`s).
*   **One `Doctor` can be associated with many `PatientResult` records.**
*   **One `PatientResult` belongs to exactly one `Doctor`.**

**3. Functional Requirements (MVP)**

**3.1. Authentication**
*   **F1.1 Login:** Laboratory staff must be able to log in using email and password via Supabase Auth. Redirect to the Patient List page upon success. Show errors on failure.
*   **F1.2 Logout:** Logged-in users must be able to log out securely.

**3.2. Test Type Management**
*   **F2.1 Create Test Type:** Provide a form to create a `TestType` (requires `name`).
*   **F2.2 Add Test Parameters:** Within a Test Type, allow adding `TestParameter`s. Form requires `name`, `unit`, `reference_range`, and optional `description`.
*   **F2.3 View Test Types:** Display a list of `TestType`s and allow viewing their associated parameters.
*   **(Optional MVP Enhancement) F2.4 Edit Test Type/Parameters:** Allow editing `TestType` (`name`) and `TestParameter` (`name`, `unit`, `reference_range`, `description`).

**3.3. Patient Management**
*   **F3.1 Create Patient:** Provide a form to create a `Patient`. Fields: `patient_unique_id` (required, unique), `full_name` (required), `date_of_birth`, `gender`, `phone` (optional). Basic validation.
*   **F3.2 View Patients:** Display a list/table of patients (`patient_unique_id`, `full_name`, `date_of_birth`, `gender`, `phone`).
*   **F3.3 Search Patients:** Provide search input on the patient list to filter by `full_name` or `patient_unique_id`.
*   **(Optional MVP Enhancement) F3.4 Edit Patient:** Allow editing existing patient details.

**3.4. Doctor Management**
*   **F_D.1 Create Doctor:** Provide a form to create a `Doctor`. Fields: `full_name` (required), `phone`, `hospital`, `bio`.
*   **F_D.2 View Doctors:** Display a list/table of `Doctor` records (`full_name`, `phone`, `hospital`).
*   **F_D.3 Edit Doctor:** Allow editing existing `Doctor` details.
*   **(Optional MVP Enhancement) F_D.4 Search Doctors:** Allow searching doctors by `full_name` or `hospital`.

**3.5. Result Entry & Management**
*   **F4.1 Create Patient Result Record:** User selects a `Patient`, selects an existing `Doctor` (required), sets the `result_date` (required).
*   **F4.2 Add Tests & Enter Values:** Within the result creation context, allow selecting `TestType`(s) and entering `value`s for their respective `TestParameter`s.
*   **F4.3 Save Results:** Save the `PatientResult` (with `patient_id`, `doctor_id`, `result_date`) and associated `ResultValue`s.
*   **F4.4 Edit Results:** Allow editing the `Doctor`, `result_date`, and `ResultValue`s of a previously saved `PatientResult`.

**3.6. Result Viewing & Output**
*   **F5.1 View All Results for a Patient:** On the Patient Detail page, display a list of their `PatientResult` records, showing `result_date` and `Doctor`'s name.
*   **F5.2 View Single Patient Result Details:** Display full details: Patient demographics (incl. `phone`), associated `Doctor` details (`full_name`, `phone`, `hospital`), `result_date`, and all included tests with parameters (`name`, `value`, `unit`, `reference_range`, `description`).
*   **F5.3 Print Result:** Provide a "Print" button on the single result view (F5.2) that formats the details cleanly for printing via the browser. Include patient info, doctor info, results.
*   **F5.4 Download Result (PDF):** Provide a "Download PDF" button on the single result view (F5.2) to generate and download a PDF mirroring the print view.

**4. Page Specifications**

**4.1. Core UI Component: Main Application Layout**
*   **Purpose:** Consistent navigation and structure.
*   **UI Elements:** Header (Logo, User Menu w/ Logout `Button` via `DropdownMenu`), Sidebar Navigation (`NavigationMenu`/Links: Patients, Doctors, Test Types), Main Content Area.

**4.2. Login Page**
*   **Route:** `/login`
*   **Purpose:** User authentication.
*   **Access:** Unauthenticated users.
*   **Features:** Email/Password input, Submit, Error display.
*   **UI:** Centered `Card` with `CardHeader`, `CardContent` (`Form` with `Label`/`Input` for email/password), `CardFooter` (`Button` "Login"). `Alert` for errors.
*   **Navigation:** To Patient List on success.

**4.3. Patient List Page**
*   **Route:** `/patients`
*   **Purpose:** View, search patients. Initiate creation.
*   **Access:** Authenticated.
*   **Features:** Display patient list, Search, Link to create, Link to detail view.
*   **UI:** Page Header "Patients". Action Bar (`Input` for search, `Button` "Add New Patient"). `Table` (Columns: Unique ID, Full Name, DOB, Gender, Phone, Actions). Actions column has "View Details" `Button`/link. `Pagination`.
*   **Data:** List of `Patient` records.
*   **Navigation:** From Sidebar. To Patient Detail, Patient Create.

**4.4. Patient Create/Edit Page**
*   **Route:** `/patients/new`, `/patients/[patientId]/edit`
*   **Purpose:** Add/modify patient data.
*   **Access:** Authenticated.
*   **Features:** Input fields for patient data, Save, Cancel, Validation.
*   **UI:** Page Header "Add/Edit Patient". `Form` (in `Card`?). `Label`/`Input` for Unique ID, Full Name, Phone. `DatePicker` for DOB. `Select`/`RadioGroup` for Gender. `Button` "Save Patient", `Button` "Cancel". `Alert` for messages.
*   **Data:** Empty form (Create), Pre-populated form (Edit).
*   **Navigation:** From Patient List/Detail. To Patient List/Detail on Save/Cancel.

**4.5. Patient Detail Page**
*   **Route:** `/patients/[patientId]`
*   **Purpose:** View patient demographics and result history. Initiate edits or new results.
*   **Access:** Authenticated.
*   **Features:** Display demographics, List results, Link to edit patient, Link to add result, Link to view specific result.
*   **UI:** Page Header "Patient: [Name]". Section 1: Demographics (`Card`? with Label/Value pairs, "Edit Patient" `Button`). Section 2: Test Results (`h2`, "Add New Result" `Button`, `Table` of results - Columns: Result Date, Doctor Name, Actions with "View Result" `Button`).
*   **Data:** Specific `Patient` details, list of associated `PatientResult` summaries.
*   **Navigation:** From Patient List. To Patient Edit, Result Detail, Result Create flow.

**4.6. Doctor List Page**
*   **Route:** `/doctors`
*   **Purpose:** View, search doctors. Initiate creation.
*   **Access:** Authenticated.
*   **Features:** Display doctor list, (Optional) Search, Link to create, Link to edit.
*   **UI:** Page Header "Doctors". Action Bar (`Button` "Add New Doctor", Optional Search `Input`). `Table` (Columns: Full Name, Phone, Hospital, Actions). Actions column has "View/Edit" `Button`.
*   **Data:** List of `Doctor` records.
*   **Navigation:** From Sidebar. To Doctor Create/Edit.

**4.7. Doctor Create/Edit Page**
*   **Route:** `/doctors/new`, `/doctors/[doctorId]/edit`
*   **Purpose:** Add/modify doctor data.
*   **Access:** Authenticated.
*   **Features:** Input fields for doctor data, Save, Cancel.
*   **UI:** Page Header "Add/Edit Doctor". `Form`. `Label`/`Input` for Full Name (Required), Phone, Hospital. `Label`/`Textarea` for Bio. `Button` "Save Doctor", `Button` "Cancel".
*   **Data:** Empty form (Create), Pre-populated form (Edit).
*   **Navigation:** From Doctor List. To Doctor List on Save/Cancel.

**4.8. Result Create/Entry Page/Modal**
*   **Route:** `/patients/[patientId]/results/new` or `Dialog` component.
*   **Purpose:** Create result, select doctor, select tests, enter values.
*   **Access:** Authenticated.
*   **Features:** Select Result Date, Select Doctor (Required), Select Test Type(s), Enter Parameter Values, Save, Cancel.
*   **UI:** `Dialog` preferred. `DialogTitle` "Add New Result...". `DialogContent` (`Form`: `DatePicker` for Date, `Select` (searchable?) for Doctor, Multi-Select/Checkboxes for Test Types, Dynamic Area with `Input` fields for parameter values per selected Test Type). `DialogFooter` (`Button` "Save Result", `Button` "Cancel").
*   **Data:** List of Doctors, Test Types, Parameters for selected types.
*   **Navigation:** From Patient Detail. To Patient Detail on Save/Cancel.

**4.9. Result Detail Page**
*   **Route:** `/results/[resultId]`
*   **Purpose:** View complete formatted result. Print/Download.
*   **Access:** Authenticated.
*   **Features:** Display patient/doctor info, result date, test results, Print, Download PDF.
*   **UI:** Page Header "Result Details". Action Bar (`Button` "Print", `Button` "Download PDF"). Report Content Area (Sections for Patient Info (incl. Phone), Doctor Info (Name, Phone, Hospital), Result Info (Date, ID), Result Sections grouped by Test Type with `Table`s for Parameters - Columns: Name, Value, Unit, Ref Range, Description).
*   **Data:** Full `PatientResult`, `ResultValue`s, `Patient`, `Doctor`, `TestParameter` details.
*   **Navigation:** From Patient Detail. To Print Dialog, PDF Download, Patient Detail (via back/breadcrumbs).

**4.10. Test Type List Page**
*   **Route:** `/test-types`
*   **Purpose:** View test types. Initiate creation/edit.
*   **Access:** Authenticated.
*   **Features:** Display test type list, Link to create, Link to edit.
*   **UI:** Page Header "Test Types". Action Bar (`Button` "Add New Test Type"). `Table` (Columns: Name, # Parameters, Actions). Actions column has "View/Edit" `Button`.
*   **Data:** List of `TestType` records.
*   **Navigation:** From Sidebar. To Test Type Create/Edit.

**4.11. Test Type Create/Edit Page**
*   **Route:** `/test-types/new`, `/test-types/[testTypeId]/edit`
*   **Purpose:** Define/modify `TestType` and its `TestParameter`s.
*   **Access:** Authenticated.
*   **Features:** Input Test Type name, Add/Edit/Remove(?) Parameters (Name, Unit, Ref Range, Description), Save, Cancel.
*   **UI:** Page Header "Add/Edit Test Type". `Form`. Section 1: `Label`/`Input` for Test Type Name. Section 2: Parameters (`h2`, `Table` or list of parameter rows with `Input`s for Name, Unit, Range, `Textarea`/`Input` for Description, Optional Remove `Button`). `Button` "Add Parameter". Action Buttons (`Button` "Save Test Type", `Button` "Cancel").
*   **Data:** Empty form (Create), Pre-populated form (Edit).
*   **Navigation:** From Test Type List. To Test Type List on Save/Cancel.

**5. Non-Functional Requirements (MVP)**

*   **NF1 Usability:** Clean, intuitive UI using `shadcn/ui`. Easy navigation.
*   **NF2 Security:** Secure authentication (Supabase Auth). Basic Row Level Security (RLS) in Supabase recommended (though potentially simplified for single-lab MVP). Protect against common web vulnerabilities (XSS, CSRF - rely on framework/Supabase features).
*   **NF3 Performance:** Core actions respond within 2-3 seconds. Optimize database queries. Use pagination for long lists.
*   **NF4 Reliability:** Data integrity via foreign keys and basic validation.
*   **NF5 Maintainability:** Well-structured React code, clear component hierarchy.

**6. Out of Scope for MVP**

*   Multi-laboratory tenancy / User roles beyond basic lab staff.
*   Advanced result validation (e.g., auto-flagging out-of-range).
*   Audit trails.
*   Customizable report templates.
*   Bulk data import/export.
*   Dashboards / Analytics.
*   Instrument integration.
*   Result approval workflows.
*   Billing / LIS integration.
*   File attachments.
*   Complex deletion logic (prefer soft delete/archiving in future, especially for Doctors/Test Types linked to results).
*   Advanced Doctor/Hospital relationship management.
*   Doctor-specific portal/login.

---