// src/App.tsx
import { Routes, Route } from "react-router-dom";

// Layout Component
import MainLayout from "./components/layout/MainLayout";

import ProtectedRoute from "./components/auth/ProtectedRoute"; // Import ProtectedRoute

// Page Components (Import your placeholders)
import LoginPage from "./pages/LoginPage";
import PatientListPage from "./pages/PatientListPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import DoctorListPage from "./pages/DoctorListPage";
// import DoctorCreateEditPage from './pages/DoctorCreateEditPage'; // Add later
// import TestTypeListPage from "./pages/TestTypeListPage";
// import TestTypeCreateEditPage from './pages/TestTypeCreateEditPage'; // Add later
// import ResultDetailPage from './pages/ResultDetailPage'; // Add later
import NotFoundPage from "./pages/NotFoundPage";
import PatientFormPage from "./pages/PatientFormPage";
import ResultDetailPage from "./pages/ResultDetailPage";
import ResultFormPage from "./pages/ResultFormPage";
import TestTypeListPage from "./pages/TestTypeListPage";
import TestTypeFormPage from "./pages/TestTypeFormPage";
import DoctorFormPage from "./pages/DoctorFormPage";
import CategoryListPage from "./pages/CategoryListPage";
import PrintHeaderDesignPage from "./pages/PrintHeaderDesignPage";
import RistourneListPage from "./pages/RistourneListPage";
import RistourneFormPage from "./pages/RistourneFormPage";
import SkipRangeManagementPage from "./pages/SkipRangeManagementPage";
import ProtidogrammePage from "./pages/ProtidogrammePage";
import ATBPage from "./pages/ATBPage";
import ATBManagementPage from "./pages/ATBManagementPage";
import ECBPage from "./pages/ECBPage";
import ECBModelManagementPage from "./pages/ECBModelManagementPage";
import VHBPage from "./pages/VHBPage";
import VIHPage from "./pages/VIHPage";
import AnapathPage from "./pages/AnapathPage";
import SpermogrammePage from "./pages/SpermogrammePage";
// Import other placeholders as you create them

function App() {
  // Placeholder for auth state - replace with Supabase logic later
  // const isAuthenticated = true; // Assume user is logged in for now

  return (
    <>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        {/* All routes nested under MainLayout will share its structure */}
        {/* We'll add proper protection later based on isAuthenticated */}

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* Index route for the root path after login */}
            <Route index element={<PatientListPage />} />
            {/* You can also make '/' redirect to '/patients' if preferred */}
            {/* <Route path="/" element={<Navigate to="/patients" replace />} /> */}
            <Route path="/patients" element={<PatientListPage />} />
            <Route path="/patients/new" element={<PatientFormPage />} />{" "}
            <Route
              path="/patients/:patientId"
              element={<PatientDetailPage />}
            />
            {/* Route for creating */}
            <Route
              path="/patients/:patientId/edit"
              element={<PatientFormPage />}
            />{" "}
            {/* results */}
            <Route
              path="/patients/:patientId/results/new"
              element={<ResultFormPage />}
            />
            <Route path="/results/:resultId" element={<ResultDetailPage />} />
            {/* Edit Result */}
            <Route
              path="/results/:resultId/edit"
              element={<ResultFormPage />}
            />
            {/* doctor */}
            <Route path="/doctors" element={<DoctorListPage />} />
            <Route path="/doctors/new" element={<DoctorFormPage />} />{" "}
            {/* Create */}
            <Route
              path="/doctors/:doctorId/edit"
              element={<DoctorFormPage />}
            />{" "}
            {/* Edit */}
            {/* Test types  */}
            <Route path="/test-types" element={<TestTypeListPage />} />
            <Route path="/test-types/new" element={<TestTypeFormPage />} />
            {/* <Route path="/test-types/:testTypeId" element={<TestTypeDetailPage />} /> */}
            <Route
              path="/test-types/:testTypeId/edit"
              element={<TestTypeFormPage />}
            />
            {/* categories */}
            <Route path="/categories" element={<CategoryListPage />} />{" "}
            {/* ristournes */}
            <Route path="/ristournes" element={<RistourneListPage />} />
            <Route path="/ristournes/new" element={<RistourneFormPage />} />
            <Route
              path="/ristournes/:ristourneId"
              element={<RistourneFormPage />}
            />
            <Route
              path="/settings/print-header"
              element={<PrintHeaderDesignPage />}
            />
            <Route
              path="/protidogramme/:resultId"
              element={<ProtidogrammePage />}
            />
            <Route
              path="/skip-range-management"
              element={<SkipRangeManagementPage />}
            />
            <Route path="/atbs" element={<ATBManagementPage />} />
            <Route path="/atb/:resultId" element={<ATBPage />} />
            <Route path="/ecb/:resultId" element={<ECBPage />} />
            <Route path="/ecb-models" element={<ECBModelManagementPage />} />
            <Route path="/vhb/:resultId" element={<VHBPage />} />
            <Route path="/vih/:resultId" element={<VIHPage />} />
            <Route path="/anapath/:resultId" element={<AnapathPage />} />
            <Route
              path="/spermogramme/:resultId"
              element={<SpermogrammePage />}
            />
          </Route>
        </Route>
        {/* Catch-all route for 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
