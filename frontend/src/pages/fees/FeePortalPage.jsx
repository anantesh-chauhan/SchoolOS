import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import DashboardLayout from "../../layouts/DashboardLayout";
import { authService } from "../../services/authService";
import { feeService } from "../../services/feeService";
import FeePortalAccount from "../../features/fees/components/FeePortalAccount";
import { Loading } from "../../features/fees/components/feePortal.shared";
import { AcademicFeeStudentPage, FeeLanding, SectionStudentPage } from "../../features/fees/components/FeeRoleViews";

export default function FeePortalPage() {
  const user = authService.getCurrentUser();
  const role = user?.role;
  const { sectionId, studentId } = useParams();
  const [settings, setSettings] = useState();
  useEffect(() => {
    feeService
      .settings()
      .then(setSettings)
      .catch((e) =>
        toast.error(e.response?.data?.message || "Fee module unavailable"),
      );
  }, []);
  const content = !settings ? (
    <Loading />
  ) : sectionId ? (
    <SectionStudentPage settings={settings} />
  ) : studentId ? (
    <AcademicFeeStudentPage settings={settings} />
  ) : ["STUDENT", "PARENT"].includes(role) ? (
    <PortalFees role={role} settings={settings} />
  ) : (
    <FeeLanding settings={settings} />
  );
  return <DashboardLayout role={role}>{content}</DashboardLayout>;
}
