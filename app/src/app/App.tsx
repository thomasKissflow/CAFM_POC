import { KissflowLoader } from "@/ui/KissflowLogo";
import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n";
import { ServicesProvider } from "@/services/context";
import type { Services } from "@/services/types";
import { loadBrand } from "@/brand/brand";
import { DataBoot } from "@/services/source";
import { DemoProvider } from "@/demo/DemoContext";
import { ROLE_HOME, SessionProvider, useSession } from "./session";
import type { RoleKey } from "@/domain/types";
import { Shell } from "./Shell";

const CommandCentre = lazy(() => import("@/screens/CommandCentre"));
const Queue = lazy(() => import("@/screens/Queue"));
const WorkOrderDetail = lazy(() => import("@/screens/WorkOrderDetail"));
const Intake = lazy(() => import("@/screens/Intake"));
const NewRequest = lazy(() => import("@/screens/NewRequest"));
const Resident = lazy(() => import("@/screens/Resident"));
const TechJobs = lazy(() => import("@/screens/tech/TechJobs"));
const TechScan = lazy(() => import("@/screens/tech/TechScan"));
const TechJob = lazy(() => import("@/screens/tech/TechJob"));
const Assets = lazy(() => import("@/screens/Assets"));
const Asset360 = lazy(() => import("@/screens/Asset360"));
const Dlp = lazy(() => import("@/screens/Dlp"));
const Handover = lazy(() => import("@/screens/Handover"));
const Compliance = lazy(() => import("@/screens/Compliance"));
const AuditPack = lazy(() => import("@/screens/AuditPack"));
const Reports = lazy(() => import("@/screens/Reports"));
const Portfolio = lazy(() => import("@/screens/Portfolio"));
const Fleet = lazy(() => import("@/screens/Fleet"));
const Permits = lazy(() => import("@/screens/Permits"));
const Ppm = lazy(() => import("@/screens/Ppm"));
const Subcontractors = lazy(() => import("@/screens/Subcontractors"));
const Before = lazy(() => import("@/screens/Before"));
const PublicRequest = lazy(() => import("@/screens/PublicRequest"));
const VoiceAgent = lazy(() => import("@/screens/VoiceAgent"));
const KfDiag = lazy(() => import("@/screens/KfDiag"));
const DataBrowser = lazy(() => import("@/screens/admin/DataBrowser"));
const AiConversations = lazy(() => import("@/screens/admin/AiConversations"));
const AiSettings = lazy(() => import("@/screens/admin/AiSettings"));
const Branding = lazy(() => import("@/screens/admin/Branding"));
const Properties = lazy(() => import("@/screens/admin/Properties"));

function Home() {
  const { role } = useSession();
  return <Navigate to={ROLE_HOME[role]} replace />;
}

function Loading() {
  return <KissflowLoader size={44} className="min-h-[50vh]" />;
}

function Localised({ children }: { children: ReactNode }) {
  const { lang } = useSession();
  return <I18nProvider lang={lang}>{children}</I18nProvider>;
}

/** Adopts the client branding Kissflow holds (Admin → Branding) as soon as the data is up. */
function BrandBoot({ services }: { services: Services }) {
  useEffect(() => { void loadBrand(services); }, [services]);
  return null;
}

/** In Kissflow, open on the signed-in user's own app role (unless they picked one already). */
function RoleFromKissflow({ roles }: { roles: RoleKey[] }) {
  const { role, setRole } = useSession();
  const [done, setDone] = useState(false);
  if (!done && roles.length > 0 && !roles.includes(role)) { setDone(true); setRole(roles[0]); }
  return null;
}

export function App() {
  const [kfRoles, setKfRoles] = useState<RoleKey[]>([]);
  const onRoles = useCallback((r: RoleKey[]) => setKfRoles(r), []);
  return (
    <SessionProvider>
      <Localised>
        <DataBoot onRoles={onRoles} fallback={<KissflowLoader size={52} label="Loading CAFM from Kissflow…" className="min-h-screen" />}>{(services) => (
        <ServicesProvider services={services}>
          <RoleFromKissflow roles={kfRoles} />
          <BrandBoot services={services} />
          <Tooltip.Provider>
            <HashRouter>
              <DemoProvider>
                <Shell>
                  <Suspense fallback={<Loading />}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/before" element={<Before />} />
                      <Route path="/command" element={<CommandCentre />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/intake" element={<Intake />} />
                      <Route path="/queue" element={<Queue />} />
                      <Route path="/wo/:id" element={<WorkOrderDetail />} />
                      <Route path="/admin/data" element={<DataBrowser />} />
                      <Route path="/admin/conversations" element={<AiConversations />} />
                      <Route path="/admin/ai" element={<AiSettings />} />
                      <Route path="/admin/brand" element={<Branding />} />
                      <Route path="/admin/properties" element={<Properties />} />
                      <Route path="/request/new" element={<NewRequest />} />
                      <Route path="/me" element={<Resident />} />
                      <Route path="/me/new" element={<NewRequest resident />} />
                      <Route path="/me/voice" element={<VoiceAgent />} />
                      <Route path="/public/:tag?" element={<PublicRequest />} />
                      <Route path="/tech" element={<TechJobs />} />
                      <Route path="/tech/scan" element={<TechScan />} />
                      <Route path="/tech/job/:id" element={<TechJob />} />
                      <Route path="/assets" element={<Assets />} />
                      <Route path="/assets/:id" element={<Asset360 />} />
                      <Route path="/dlp" element={<Dlp />} />
                      <Route path="/handover" element={<Handover />} />
                      <Route path="/compliance" element={<Compliance />} />
                      <Route path="/compliance/audit/:siteId" element={<AuditPack />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/fleet" element={<Fleet />} />
                      <Route path="/permits" element={<Permits />} />
                      <Route path="/ppm" element={<Ppm />} />
                      <Route path="/subcontractors" element={<Subcontractors />} />
                      <Route path="/kf-diag" element={<KfDiag />} />
                      <Route path="*" element={<Home />} />
                    </Routes>
                  </Suspense>
                </Shell>
              </DemoProvider>
            </HashRouter>
          </Tooltip.Provider>
        </ServicesProvider>
        )}</DataBoot>
      </Localised>
      <Toaster position="bottom-center" toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 4, border: "1px solid var(--color-seam-strong)" } }} />
    </SessionProvider>
  );
}
