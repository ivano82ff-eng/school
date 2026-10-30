import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import OfficeLayout from './components/OfficeLayout';
import Home from './pages/Home';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import LessonPage from './pages/LessonPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Teacher from './pages/Teacher';
import ApplyPage from './pages/ApplyPage';
import ParentPortal from './pages/ParentPortal';
import OfficeHome from './pages/office/OfficeHome';
import ContactsPage from './pages/office/ContactsPage';
import GroupsPage from './pages/office/GroupsPage';
import PaymentsPage from './pages/office/PaymentsPage';
import SchedulePage from './pages/office/SchedulePage';
import LeadsPage from './pages/office/LeadsPage';
import AttendancePage from './pages/office/AttendancePage';
import HomeworkPage from './pages/office/HomeworkPage';
import ReportsPage from './pages/office/ReportsPage';
import AnnouncementsPage from './pages/office/AnnouncementsPage';
import GradebookPage from './pages/office/GradebookPage';
import MaterialsPage from './pages/office/MaterialsPage';
import MessagesPage from './pages/MessagesPage';
import CertificatePage from './pages/CertificatePage';
import DiaryPage from './pages/DiaryPage';
import PortfolioPage from './pages/PortfolioPage';
import TrialsPage from './pages/office/TrialsPage';
import DocumentsPage from './pages/office/DocumentsPage';
import CourseBuilderPage from './pages/CourseBuilderPage';
import ShareRedirectPage from './pages/ShareRedirectPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminRolesPage from './pages/admin/AdminRolesPage';
import AdminGuidePage from './pages/admin/AdminGuidePage';
import LandingsPage from './pages/office/LandingsPage';
import LandingBuilderPage from './pages/office/LandingBuilderPage';
import LandingAnalyticsPage from './pages/office/LandingAnalyticsPage';
import AnalyticsBuilderPage from './pages/office/AnalyticsBuilderPage';
import PublicLandingPage from './pages/PublicLandingPage';
import ProductPitchPage from './pages/ProductPitchPage';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="l/:slug" element={<PublicLandingPage />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="product" element={<ProductPitchPage />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="apply" element={<ApplyPage />} />
        <Route path="s/:token" element={<ShareRedirectPage />} />
        <Route
          path="teacher/builder/:courseId"
          element={
            <Private>
              <CourseBuilderPage />
            </Private>
          }
        />
        <Route
          path="lessons/:id"
          element={
            <Private>
              <LessonPage />
            </Private>
          }
        />
        <Route
          path="dashboard"
          element={
            <Private>
              <Dashboard />
            </Private>
          }
        />
        <Route
          path="documents"
          element={
            <Private>
              <DocumentsPage />
            </Private>
          }
        />
        <Route
          path="portfolio"
          element={
            <Private>
              <PortfolioPage />
            </Private>
          }
        />
        <Route
          path="diary"
          element={
            <Private>
              <DiaryPage />
            </Private>
          }
        />
        <Route
          path="messages"
          element={
            <Private>
              <MessagesPage />
            </Private>
          }
        />
        <Route
          path="certificates/:id"
          element={
            <Private>
              <CertificatePage />
            </Private>
          }
        />
        <Route
          path="parent"
          element={
            <Private>
              <ParentPortal />
            </Private>
          }
        />
        <Route
          path="teacher"
          element={
            <Private>
              <Teacher />
            </Private>
          }
        />
        <Route
          path="admin"
          element={
            <Private>
              <AdminLayout />
            </Private>
          }
        >
          <Route index element={<Navigate to="guide" replace />} />
          <Route path="guide" element={<AdminGuidePage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="roles" element={<AdminRolesPage />} />
          <Route path="roles/:code" element={<AdminRolesPage />} />
        </Route>
        <Route
          path="office"
          element={
            <Private>
              <OfficeLayout />
            </Private>
          }
        >
          <Route index element={<OfficeHome />} />
          <Route path="landings" element={<LandingsPage />} />
          <Route path="landings/:id/edit" element={<LandingBuilderPage />} />
          <Route path="landings/:id/analytics" element={<LandingAnalyticsPage />} />
          <Route path="analytics" element={<AnalyticsBuilderPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="trials" element={<TrialsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="homework" element={<HomeworkPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="gradebook" element={<GradebookPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>
    </Routes>
  );
}
