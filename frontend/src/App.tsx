import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ApartmentIcon from "@mui/icons-material/Apartment";
import BarChartIcon from "@mui/icons-material/BarChart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FolderIcon from "@mui/icons-material/Folder";
import KeyIcon from "@mui/icons-material/Key";
import ListAltIcon from "@mui/icons-material/ListAlt";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import QueueIcon from "@mui/icons-material/Queue";
import ReplayIcon from "@mui/icons-material/Replay";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { api, authStore } from "@/services/api";
import type {
  AuthUser,
  DeadLetterEntry,
  Job,
  JobHistory,
  JobState,
  MetricsOverview,
  Organization,
  Project,
  Queue,
  Worker
} from "@/types/api";

type Page =
  | "dashboard"
  | "organizations"
  | "projects"
  | "queues"
  | "jobs"
  | "workers"
  | "jobDetails"
  | "metrics"
  | "deadLetter";

type AppData = {
  overview: MetricsOverview;
  organizations: Organization[];
  projects: Project[];
  queues: Queue[];
  jobs: Job[];
  workers: Worker[];
  deadLetter: DeadLetterEntry[];
};

type Snack = {
  message: string;
  severity: "success" | "error" | "info";
};

const drawerWidth = 264;

const jobColors: Record<JobState, string> = {
  QUEUED: "#2563eb",
  SCHEDULED: "#7c3aed",
  CLAIMED: "#0891b2",
  RUNNING: "#059669",
  COMPLETED: "#16a34a",
  FAILED: "#dc2626",
  RETRYING: "#d97706",
  DEAD_LETTER: "#991b1b"
};

const navItems: Array<{
  page: Page;
  label: string;
  icon: ReactNode;
}> = [
  { page: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { page: "organizations", label: "Create Organization", icon: <ApartmentIcon /> },
  { page: "projects", label: "Create Project", icon: <FolderIcon /> },
  { page: "queues", label: "Queue Management", icon: <QueueIcon /> },
  { page: "jobs", label: "Job Management", icon: <ListAltIcon /> },
  { page: "workers", label: "Worker Management", icon: <PrecisionManufacturingIcon /> },
  { page: "metrics", label: "Metrics", icon: <BarChartIcon /> },
  { page: "deadLetter", label: "Dead Letter Queue", icon: <ErrorOutlineIcon /> }
];

const pageValues: Page[] = [
  "dashboard",
  "organizations",
  "projects",
  "queues",
  "jobs",
  "workers",
  "jobDetails",
  "metrics",
  "deadLetter"
];

const getInitialPage = (): Page => {
  const value = new URLSearchParams(window.location.search).get("page");

  return pageValues.includes(value as Page) ? (value as Page) : "dashboard";
};

const getInitialAuthMode = () =>
  new URLSearchParams(window.location.search).get("auth") === "register" ? "register" : "login";

const emptyData: AppData = {
  overview: {
    jobsByState: {
      QUEUED: 0,
      SCHEDULED: 0,
      CLAIMED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRYING: 0,
      DEAD_LETTER: 0
    },
    workersByStatus: {
      ONLINE: 0,
      DRAINING: 0,
      OFFLINE: 0
    },
    dlqCount: 0,
    successRate: 0,
    queues: [],
    recentExecutions: []
  },
  organizations: [],
  projects: [],
  queues: [],
  jobs: [],
  workers: [],
  deadLetter: []
};

export default function App() {
  const [page, setPage] = useState<Page>(getInitialPage);
  const [authMode, setAuthMode] = useState<"login" | "register">(getInitialAuthMode);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobHistory, setJobHistory] = useState<JobHistory | null>(null);
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);

  const showSnack = useCallback((message: string, severity: Snack["severity"] = "success") => {
    setSnack({ message, severity });
  }, []);

  const refreshData = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
      }

      try {
        const [overview, organizations, projects, queues, jobs, workers, deadLetter] =
          await Promise.all([
            api.metricsOverview(),
            api.organizations(),
            api.projects(),
            api.queues(),
            api.jobs(),
            api.workers(),
            api.deadLetter()
          ]);

        const params = new URLSearchParams(window.location.search);
        const projectParam = params.get("project");
        const selectedProject =
          projects.find(
            (project) =>
              project.slug === projectParam ||
              project.name.toLowerCase().replace(/\s+/g, "-") === projectParam
          ) ?? projects[0];

        setData({ overview, organizations, projects, queues, jobs, workers, deadLetter });

        setSelectedProjectId((current) => current || selectedProject?.id || "");
        setSelectedJobId((current) => current || jobs[0]?.id || "");
      } catch (error) {
        showSnack(errorMessage(error, "Unable to load application data"), "error");
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [showSnack]
  );

  useEffect(() => {
    const bootstrap = async () => {
      if (new URLSearchParams(window.location.search).get("demo") === "1") {
        setUser({
          id: "demo-user",
          email: "admin@scheduler.dev",
          name: "Admin User"
        });
        await refreshData({ silent: true });
        setAuthLoading(false);
        return;
      }

      const token = authStore.getAccessToken();

      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const result = await api.me();
        setUser(result.user);
        await refreshData({ silent: true });
      } catch {
        authStore.clear();
      } finally {
        setAuthLoading(false);
      }
    };

    void bootstrap();
  }, [refreshData]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    void refreshData({ silent: true });
    const interval = window.setInterval(() => {
      void refreshData({ silent: true });
    }, 20_000);

    return () => window.clearInterval(interval);
  }, [refreshData, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const dialog = new URLSearchParams(window.location.search).get("dialog");

    if (dialog === "queue") {
      setQueueDialogOpen(true);
    }
    if (dialog === "job") {
      setJobDialogOpen(true);
    }
    if (dialog === "worker") {
      setWorkerDialogOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedJobId) {
      setJobHistory(null);
      return;
    }

    const loadHistory = async () => {
      setJobHistoryLoading(true);
      try {
        setJobHistory(await api.jobHistory(selectedJobId));
      } catch {
        setJobHistory(null);
      } finally {
        setJobHistoryLoading(false);
      }
    };

    void loadHistory();
  }, [selectedJobId]);

  const selectedProject = data.projects.find((project) => project.id === selectedProjectId) ?? null;
  const projectQueues = data.queues.filter((queue) =>
    selectedProjectId ? queue.projectId === selectedProjectId : true
  );
  const projectJobs = data.jobs.filter((job) =>
    selectedProjectId ? job.projectId === selectedProjectId : true
  );
  const projectWorkers = data.workers.filter((worker) =>
    selectedProjectId ? worker.projectId === selectedProjectId : true
  );
  const selectedJob = data.jobs.find((job) => job.id === selectedJobId) ?? null;

  const handleAuthenticated = async (result: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => {
    authStore.setTokens(result);
    setUser(result.user);
    showSnack(`Welcome, ${result.user.name}`);
    await refreshData();
  };

  const handleLogout = async () => {
    const refreshToken = authStore.getRefreshToken();

    try {
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch {
      // Logout remains local even if the token is already expired.
    } finally {
      authStore.clear();
      setUser(null);
      setData(emptyData);
      setSelectedProjectId("");
      setSelectedJobId("");
      setPage("dashboard");
    }
  };

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setLoading(true);
    try {
      await action();
      await refreshData({ silent: true });
      showSnack(successMessage);
    } catch (error) {
      showSnack(errorMessage(error, "Action failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Box className="center-screen">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen
          mode={authMode}
          onModeChange={setAuthMode}
          onAuthenticated={handleAuthenticated}
          onError={(message) => showSnack(message, "error")}
        />
        <SnackView snack={snack} onClose={() => setSnack(null)} />
      </>
    );
  }

  return (
    <Box className="app-layout">
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box"
          }
        }}
      >
        <Stack className="brand-panel" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <span className="brand-mark">
              <WorkspacesIcon fontSize="small" />
            </span>
            <Box>
              <Typography fontWeight={900}>Scheduler</Typography>
              <Typography variant="caption" color="text.secondary">
                Production control plane
              </Typography>
            </Box>
          </Stack>
        </Stack>
        <List className="nav-list">
          {navItems.map((item) => (
            <ListItemButton
              key={item.page}
              selected={page === item.page}
              onClick={() => setPage(item.page)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton
            onClick={() => {
              setPage("queues");
              setQueueDialogOpen(true);
            }}
          >
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Create Queue" />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              setPage("jobs");
              setJobDialogOpen(true);
            }}
          >
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Create Job" />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              setPage("workers");
              setWorkerDialogOpen(true);
            }}
          >
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Register Worker" />
          </ListItemButton>
        </List>
      </Drawer>

      <Box className="workspace">
        <AppBar position="sticky" color="inherit" elevation={0} className="appbar">
          <Toolbar className="topbar">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControl size="small" className="project-select">
                <InputLabel>Project</InputLabel>
                <Select
                  label="Project"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  {data.projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {loading ? <LinearProgress className="top-progress" /> : null}
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button size="small" href="http://localhost:4000/metrics" target="_blank">
                Prometheus
              </Button>
              <Avatar className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</Avatar>
              <Box>
                <Typography variant="body2" fontWeight={800}>
                  {user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
              <IconButton aria-label="Log out" onClick={() => void handleLogout()}>
                <LogoutIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" className="content">
          {page === "dashboard" ? (
            <DashboardPage
              data={data}
              selectedProject={selectedProject}
              queues={projectQueues}
              jobs={projectJobs}
              workers={projectWorkers}
              onCreateQueue={() => setQueueDialogOpen(true)}
              onCreateJob={() => setJobDialogOpen(true)}
              onViewJob={(jobId) => {
                setSelectedJobId(jobId);
                setPage("jobDetails");
              }}
            />
          ) : null}
          {page === "organizations" ? (
            <CreateOrganizationPage
              organizations={data.organizations}
              onCreate={(body) =>
                runAction(async () => {
                  await api.createOrganization(body);
                }, "Organization created")
              }
            />
          ) : null}
          {page === "projects" ? (
            <CreateProjectPage
              organizations={data.organizations}
              projects={data.projects}
              onCreate={(body) =>
                runAction(async () => {
                  const project = await api.createProject(body);
                  setSelectedProjectId(project.id);
                }, "Project created")
              }
            />
          ) : null}
          {page === "queues" ? (
            <QueuesPage
              queues={projectQueues}
              selectedProject={selectedProject}
              onCreate={() => setQueueDialogOpen(true)}
              onPause={(queueId) => runAction(() => api.pauseQueue(queueId), "Queue paused")}
              onResume={(queueId) => runAction(() => api.resumeQueue(queueId), "Queue resumed")}
              onDelete={(queueId) => runAction(() => api.deleteQueue(queueId), "Queue archived")}
            />
          ) : null}
          {page === "jobs" ? (
            <JobsPage
              jobs={projectJobs}
              queues={projectQueues}
              onCreate={() => setJobDialogOpen(true)}
              onCancel={(jobId) => runAction(() => api.cancelJob(jobId), "Job cancelled")}
              onRetry={(jobId) => runAction(() => api.retryJob(jobId), "Job requeued")}
              onDetails={(jobId) => {
                setSelectedJobId(jobId);
                setPage("jobDetails");
              }}
            />
          ) : null}
          {page === "workers" ? (
            <WorkersPage
              workers={projectWorkers}
              selectedProject={selectedProject}
              onRegister={() => setWorkerDialogOpen(true)}
              onShutdown={(workerId) =>
                runAction(() => api.shutdownWorker(workerId), "Worker draining")
              }
            />
          ) : null}
          {page === "jobDetails" ? (
            <JobDetailsPage
              job={selectedJob}
              history={jobHistory}
              loading={jobHistoryLoading}
              onRetry={(jobId) => runAction(() => api.retryJob(jobId), "Job requeued")}
              onBack={() => setPage("jobs")}
            />
          ) : null}
          {page === "metrics" ? (
            <MetricsPage overview={data.overview} queues={projectQueues} />
          ) : null}
          {page === "deadLetter" ? (
            <DeadLetterPage
              entries={data.deadLetter}
              onRetry={(jobId) => runAction(() => api.retryJob(jobId), "DLQ job requeued")}
            />
          ) : null}
        </Box>
      </Box>

      <CreateQueueDialog
        open={queueDialogOpen}
        project={selectedProject}
        onClose={() => setQueueDialogOpen(false)}
        onCreate={(body) =>
          runAction(async () => {
            await api.createQueue(body);
            setQueueDialogOpen(false);
          }, "Queue created")
        }
      />
      <CreateJobDialog
        open={jobDialogOpen}
        project={selectedProject}
        queues={projectQueues}
        onClose={() => setJobDialogOpen(false)}
        onCreate={(body) =>
          runAction(async () => {
            await createJob(body);
            setJobDialogOpen(false);
          }, "Job created")
        }
      />
      <RegisterWorkerDialog
        open={workerDialogOpen}
        project={selectedProject}
        queues={projectQueues}
        onClose={() => setWorkerDialogOpen(false)}
        onCreate={(body) =>
          runAction(async () => {
            await api.registerWorker(body);
            setWorkerDialogOpen(false);
          }, "Worker registered")
        }
      />
      <SnackView snack={snack} onClose={() => setSnack(null)} />
    </Box>
  );
}

function AuthScreen(props: {
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onAuthenticated: (result: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    organizationName: ""
  });

  const submit = async () => {
    setLoading(true);
    try {
      const result =
        props.mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.register({
              email: form.email,
              name: form.name,
              password: form.password,
              organizationName: form.organizationName
            });
      await props.onAuthenticated(result);
    } catch (error) {
      props.onError(errorMessage(error, "Authentication failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-shell">
      <Paper className="auth-panel" variant="outlined">
        <Stack spacing={3}>
          <Stack spacing={1}>
            <span className="brand-mark large">
              <WorkspacesIcon />
            </span>
            <Typography variant="h4" fontWeight={900}>
              {props.mode === "login" ? "Log in to Scheduler" : "Create your workspace"}
            </Typography>
            <Typography color="text.secondary">
              Manage queues, jobs, workers, retries, and failures from one control plane.
            </Typography>
          </Stack>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              fullWidth
            />
            {props.mode === "register" ? (
              <>
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  fullWidth
                />
                <TextField
                  label="Organization"
                  value={form.organizationName}
                  onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
                  fullWidth
                />
              </>
            ) : null}
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              fullWidth
            />
            <Button
              size="large"
              variant="contained"
              startIcon={props.mode === "login" ? <LoginIcon /> : <KeyIcon />}
              disabled={loading}
              onClick={() => void submit()}
            >
              {loading ? "Please wait" : props.mode === "login" ? "Log in" : "Create account"}
            </Button>
          </Stack>
          <Divider />
          <Button onClick={() => props.onModeChange(props.mode === "login" ? "register" : "login")}>
            {props.mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function DashboardPage(props: {
  data: AppData;
  selectedProject: Project | null;
  queues: Queue[];
  jobs: Job[];
  workers: Worker[];
  onCreateQueue: () => void;
  onCreateJob: () => void;
  onViewJob: (jobId: string) => void;
}) {
  const chartData = chartFromStates(props.data.overview.jobsByState);
  const queuedJobs = props.jobs.filter((job) => job.state === "QUEUED").length;
  const runningJobs = props.jobs.filter((job) => job.state === "RUNNING").length;
  const onlineWorkers = props.workers.filter((worker) => worker.status === "ONLINE").length;

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Dashboard
          </Typography>
          <Typography color="text.secondary">
            {props.selectedProject
              ? `${props.selectedProject.name} operational summary`
              : "Create a project to start scheduling jobs"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<QueueIcon />} onClick={props.onCreateQueue}>
            Queue
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={props.onCreateJob}>
            Job
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<ListAltIcon />}
            label="Queued jobs"
            value={queuedJobs}
            helper="ready to claim"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<PrecisionManufacturingIcon />}
            label="Running jobs"
            value={runningJobs}
            helper={`${onlineWorkers} online workers`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<ErrorOutlineIcon />}
            label="Dead letter"
            value={props.data.overview.dlqCount}
            helper="needs inspection"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<CheckCircleIcon />}
            label="Success rate"
            value={`${Math.round(props.data.overview.successRate * 100)}%`}
            helper="recent executions"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Panel title="Job states">
            {chartData.some((item) => item.count > 0) ? (
              <Box height={320}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((item) => (
                        <Cell key={item.state} fill={jobColors[item.state]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <EmptyState
                title="No jobs yet"
                description="Create a job to see queue pressure and execution states."
              />
            )}
          </Panel>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Panel title="Recent jobs">
            <Stack spacing={1}>
              {props.jobs.slice(0, 6).map((job) => (
                <button className="row-button" key={job.id} onClick={() => props.onViewJob(job.id)}>
                  <span>
                    <Typography fontWeight={800}>{job.type}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {job.queue?.name ?? "Unassigned queue"} · priority {job.priority}
                    </Typography>
                  </span>
                  <StatusChip label={job.state} />
                </button>
              ))}
              {props.jobs.length === 0 ? (
                <EmptyState
                  title="No jobs in this project"
                  description="Submit immediate, delayed, scheduled, recurring, or batch jobs."
                />
              ) : null}
            </Stack>
          </Panel>
        </Grid>
      </Grid>
    </Stack>
  );
}

function CreateOrganizationPage(props: {
  organizations: Organization[];
  onCreate: (body: { name: string; slug?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={5}>
        <Panel title="Create Organization">
          <Stack spacing={2}>
            <TextField
              label="Organization name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />
            <TextField
              label="Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder={toSlug(name)}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={!name.trim()}
              onClick={() => void props.onCreate({ name, slug: slug || undefined })}
            >
              Create organization
            </Button>
          </Stack>
        </Panel>
      </Grid>
      <Grid item xs={12} md={7}>
        <Panel title="Organizations">
          <SimpleTable
            rows={props.organizations}
            emptyTitle="No organizations yet"
            columns={[
              { label: "Name", render: (row) => row.name },
              { label: "Slug", render: (row) => row.slug },
              { label: "Projects", render: (row) => row._count?.projects ?? 0 }
            ]}
          />
        </Panel>
      </Grid>
    </Grid>
  );
}

function CreateProjectPage(props: {
  organizations: Organization[];
  projects: Project[];
  onCreate: (body: {
    organizationId: string;
    name: string;
    slug?: string;
    description?: string;
  }) => Promise<void>;
}) {
  const [organizationId, setOrganizationId] = useState(props.organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!organizationId && props.organizations[0]) {
      setOrganizationId(props.organizations[0].id);
    }
  }, [organizationId, props.organizations]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={5}>
        <Panel title="Create Project">
          <Stack spacing={2}>
            <TextField
              label="Organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              select
              fullWidth
            >
              {props.organizations.map((organization) => (
                <MenuItem key={organization.id} value={organization.id}>
                  {organization.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />
            <TextField
              label="Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder={toSlug(name)}
              fullWidth
            />
            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minRows={3}
              multiline
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={!organizationId || !name.trim()}
              onClick={() =>
                void props.onCreate({
                  organizationId,
                  name,
                  slug: slug || undefined,
                  description: description || undefined
                })
              }
            >
              Create project
            </Button>
          </Stack>
        </Panel>
      </Grid>
      <Grid item xs={12} md={7}>
        <Panel title="Projects">
          <SimpleTable
            rows={props.projects}
            emptyTitle="No projects yet"
            columns={[
              { label: "Name", render: (row) => row.name },
              { label: "Organization", render: (row) => row.organization.name },
              { label: "Queues", render: (row) => row._count.queues },
              { label: "Jobs", render: (row) => row._count.jobs }
            ]}
          />
        </Panel>
      </Grid>
    </Grid>
  );
}

function QueuesPage(props: {
  queues: Queue[];
  selectedProject: Project | null;
  onCreate: () => void;
  onPause: (queueId: string) => Promise<void>;
  onResume: (queueId: string) => Promise<void>;
  onDelete: (queueId: string) => Promise<void>;
}) {
  return (
    <Panel
      title="Queue Management"
      action={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!props.selectedProject}
          onClick={props.onCreate}
        >
          Create queue
        </Button>
      }
    >
      <SimpleTable
        rows={props.queues}
        emptyTitle="No queues yet"
        emptyDescription="Create a queue to start accepting jobs for this project."
        columns={[
          { label: "Name", render: (row) => <strong>{row.name}</strong> },
          { label: "Status", render: (row) => <StatusChip label={row.status} /> },
          { label: "Concurrency", render: (row) => row.concurrencyLimit },
          { label: "Priority", render: (row) => row.priorityWeight },
          { label: "Jobs", render: (row) => row._count?.jobs ?? 0 },
          {
            label: "Actions",
            align: "right",
            render: (row) => (
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {row.status === "PAUSED" ? (
                  <Button size="small" onClick={() => void props.onResume(row.id)}>
                    Resume
                  </Button>
                ) : (
                  <Button size="small" onClick={() => void props.onPause(row.id)}>
                    Pause
                  </Button>
                )}
                <Button size="small" color="error" onClick={() => void props.onDelete(row.id)}>
                  Archive
                </Button>
              </Stack>
            )
          }
        ]}
      />
    </Panel>
  );
}

function JobsPage(props: {
  jobs: Job[];
  queues: Queue[];
  onCreate: () => void;
  onCancel: (jobId: string) => Promise<void>;
  onRetry: (jobId: string) => Promise<void>;
  onDetails: (jobId: string) => void;
}) {
  return (
    <Panel
      title="Job Management"
      action={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={props.queues.length === 0}
          onClick={props.onCreate}
        >
          Create job
        </Button>
      }
    >
      <SimpleTable
        rows={props.jobs}
        emptyTitle="No jobs yet"
        emptyDescription="Create a job after adding a queue to this project."
        columns={[
          { label: "Type", render: (row) => row.type },
          { label: "State", render: (row) => <StatusChip label={row.state} /> },
          { label: "Queue", render: (row) => row.queue?.name ?? row.queueId },
          { label: "Attempts", render: (row) => `${row.attempts}/${row.maxAttempts}` },
          { label: "Available", render: (row) => formatDate(row.availableAt) },
          {
            label: "Actions",
            align: "right",
            render: (row) => (
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={() => props.onDetails(row.id)}>
                  Details
                </Button>
                <Button size="small" onClick={() => void props.onRetry(row.id)}>
                  Retry
                </Button>
                <Button size="small" color="error" onClick={() => void props.onCancel(row.id)}>
                  Cancel
                </Button>
              </Stack>
            )
          }
        ]}
      />
    </Panel>
  );
}

function WorkersPage(props: {
  workers: Worker[];
  selectedProject: Project | null;
  onRegister: () => void;
  onShutdown: (workerId: string) => Promise<void>;
}) {
  return (
    <Panel
      title="Worker Management"
      action={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!props.selectedProject}
          onClick={props.onRegister}
        >
          Register worker
        </Button>
      }
    >
      <SimpleTable
        rows={props.workers}
        emptyTitle="No workers registered"
        emptyDescription="Register a worker to poll queues and execute jobs."
        columns={[
          { label: "Name", render: (row) => <strong>{row.name}</strong> },
          { label: "Status", render: (row) => <StatusChip label={row.status} /> },
          { label: "Queue", render: (row) => row.queue?.name ?? "All project queues" },
          { label: "Concurrency", render: (row) => row.concurrency },
          { label: "Last heartbeat", render: (row) => formatDate(row.lastHeartbeatAt) },
          {
            label: "Actions",
            align: "right",
            render: (row) => (
              <Button size="small" color="warning" onClick={() => void props.onShutdown(row.id)}>
                Drain
              </Button>
            )
          }
        ]}
      />
    </Panel>
  );
}

function JobDetailsPage(props: {
  job: Job | null;
  history: JobHistory | null;
  loading: boolean;
  onRetry: (jobId: string) => Promise<void>;
  onBack: () => void;
}) {
  if (!props.job) {
    return (
      <Panel title="Job Details">
        <EmptyState
          title="Select a job"
          description="Open a job from Job Management to inspect execution history."
        />
      </Panel>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Job Details
          </Typography>
          <Typography color="text.secondary">{props.job.id}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={props.onBack}>Back</Button>
          <Button
            variant="contained"
            startIcon={<ReplayIcon />}
            onClick={() => void props.onRetry(props.job!.id)}
          >
            Retry
          </Button>
        </Stack>
      </Stack>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Panel title="Summary">
            <Stack spacing={1.5}>
              <StatusChip label={props.job.state} />
              <Typography>Type: {props.job.type}</Typography>
              <Typography>Queue: {props.job.queue?.name ?? props.job.queueId}</Typography>
              <Typography>
                Attempts: {props.job.attempts}/{props.job.maxAttempts}
              </Typography>
              <Typography>Available: {formatDate(props.job.availableAt)}</Typography>
              <Typography>Scheduled: {formatDate(props.job.scheduledFor)}</Typography>
              <Alert severity={props.job.errorMessage ? "error" : "success"}>
                {props.job.errorMessage ?? "No error recorded"}
              </Alert>
            </Stack>
          </Panel>
        </Grid>
        <Grid item xs={12} md={8}>
          <Panel title="Execution History">
            {props.loading ? <LinearProgress /> : null}
            <SimpleTable
              rows={props.history?.executions ?? []}
              emptyTitle="No executions yet"
              columns={[
                { label: "Attempt", render: (row) => row.attempt },
                { label: "Status", render: (row) => <StatusChip label={row.status} /> },
                { label: "Started", render: (row) => formatDate(row.startedAt) },
                { label: "Finished", render: (row) => formatDate(row.finishedAt) },
                { label: "Duration", render: (row) => formatDuration(row.durationMs) }
              ]}
            />
          </Panel>
        </Grid>
      </Grid>
    </Stack>
  );
}

function MetricsPage(props: { overview: MetricsOverview; queues: Queue[] }) {
  const chartData = chartFromStates(props.overview.jobsByState);

  return (
    <Stack spacing={2}>
      <Panel
        title="Metrics"
        action={
          <Button href="http://localhost:4000/metrics" target="_blank">
            Open Prometheus
          </Button>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
            <Box height={340}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((item) => (
                      <Cell key={item.state} fill={jobColors[item.state]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Stack spacing={2}>
              <MetricLine
                label="Success rate"
                value={`${Math.round(props.overview.successRate * 100)}%`}
              />
              <MetricLine label="Dead letter jobs" value={props.overview.dlqCount} />
              <MetricLine label="Online workers" value={props.overview.workersByStatus.ONLINE} />
              <MetricLine label="Queues in scope" value={props.queues.length} />
            </Stack>
          </Grid>
        </Grid>
      </Panel>
      <Panel title="Queue Capacity">
        <SimpleTable
          rows={props.queues}
          emptyTitle="No queue metrics yet"
          columns={[
            { label: "Queue", render: (row) => row.name },
            { label: "Status", render: (row) => <StatusChip label={row.status} /> },
            { label: "Concurrency", render: (row) => row.concurrencyLimit },
            { label: "Jobs", render: (row) => row._count?.jobs ?? 0 },
            { label: "Workers", render: (row) => row._count?.workers ?? 0 }
          ]}
        />
      </Panel>
    </Stack>
  );
}

function DeadLetterPage(props: {
  entries: DeadLetterEntry[];
  onRetry: (jobId: string) => Promise<void>;
}) {
  return (
    <Panel title="Dead Letter Queue">
      <SimpleTable
        rows={props.entries}
        emptyTitle="Dead letter queue is empty"
        emptyDescription="Permanent failures will appear here for inspection and manual retry."
        columns={[
          { label: "Reason", render: (row) => <StatusChip label={row.reason} /> },
          { label: "Queue", render: (row) => row.queue.name },
          { label: "Job", render: (row) => row.job.id },
          { label: "Failure", render: (row) => row.failureMessage },
          { label: "Failed", render: (row) => formatDate(row.failedAt) },
          {
            label: "Actions",
            align: "right",
            render: (row) => (
              <Button
                size="small"
                startIcon={<ReplayIcon />}
                onClick={() => void props.onRetry(row.job.id)}
              >
                Retry
              </Button>
            )
          }
        ]}
      />
    </Panel>
  );
}

function CreateQueueDialog(props: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onCreate: (body: {
    projectId: string;
    name: string;
    slug: string;
    concurrencyLimit: number;
    priorityWeight: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [priorityWeight, setPriorityWeight] = useState(50);

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Queue</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {!props.project ? (
            <Alert severity="warning">Select or create a project first.</Alert>
          ) : null}
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={toSlug(name)}
            fullWidth
          />
          <TextField
            label="Concurrency limit"
            type="number"
            value={concurrencyLimit}
            onChange={(event) => setConcurrencyLimit(Number(event.target.value))}
            fullWidth
          />
          <TextField
            label="Priority weight"
            type="number"
            value={priorityWeight}
            onChange={(event) => setPriorityWeight(Number(event.target.value))}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!props.project || !name.trim()}
          onClick={() =>
            props.project
              ? void props.onCreate({
                  projectId: props.project.id,
                  name,
                  slug: slug || toSlug(name),
                  concurrencyLimit,
                  priorityWeight
                })
              : undefined
          }
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type CreateJobInput = {
  type: "IMMEDIATE" | "DELAYED" | "SCHEDULED" | "RECURRING" | "BATCH";
  projectId: string;
  queueId: string;
  priority: number;
  payload: Record<string, unknown>;
  maxAttempts: number;
  delaySeconds: number;
  scheduledFor: string;
  recurringName: string;
  cronExpression: string;
  timezone: string;
  batchCount: number;
};

function CreateJobDialog(props: {
  open: boolean;
  project: Project | null;
  queues: Queue[];
  onClose: () => void;
  onCreate: (body: CreateJobInput) => Promise<void>;
}) {
  const [type, setType] = useState<CreateJobInput["type"]>("IMMEDIATE");
  const [queueId, setQueueId] = useState("");
  const [priority, setPriority] = useState(50);
  const [payloadText, setPayloadText] = useState(
    '{\n  "jobName": "Send Invoice Email",\n  "invoiceId": "INV-2026-0715",\n  "recipient": "billing@acmepayments.com"\n}'
  );
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [delaySeconds, setDelaySeconds] = useState(300);
  const [scheduledFor, setScheduledFor] = useState("");
  const [recurringName, setRecurringName] = useState("");
  const [cronExpression, setCronExpression] = useState("0 2 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [batchCount, setBatchCount] = useState(10);
  const [payloadError, setPayloadError] = useState("");

  useEffect(() => {
    if (!queueId && props.queues[0]) {
      setQueueId(props.queues[0].id);
    }
  }, [props.queues, queueId]);

  const submit = () => {
    if (!props.project) {
      return;
    }

    try {
      const payload = parsePayload(payloadText);
      setPayloadError("");
      void props.onCreate({
        type,
        projectId: props.project.id,
        queueId,
        priority,
        payload,
        maxAttempts,
        delaySeconds,
        scheduledFor,
        recurringName,
        cronExpression,
        timezone,
        batchCount
      });
    } catch (error) {
      setPayloadError(errorMessage(error, "Payload must be valid JSON object"));
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Job</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {!props.project ? (
            <Alert severity="warning">Select or create a project first.</Alert>
          ) : null}
          {props.queues.length === 0 ? (
            <Alert severity="info">Create a queue before submitting jobs.</Alert>
          ) : null}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Job type"
                value={type}
                onChange={(event) => setType(event.target.value as CreateJobInput["type"])}
                select
                fullWidth
              >
                <MenuItem value="IMMEDIATE">Immediate</MenuItem>
                <MenuItem value="DELAYED">Delayed</MenuItem>
                <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                <MenuItem value="RECURRING">Recurring</MenuItem>
                <MenuItem value="BATCH">Batch</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Queue"
                value={queueId}
                onChange={(event) => setQueueId(event.target.value)}
                select
                fullWidth
              >
                {props.queues.map((queue) => (
                  <MenuItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {type === "RECURRING" ? (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Name"
                    value={recurringName}
                    onChange={(event) => setRecurringName(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Cron expression"
                    value={cronExpression}
                    onChange={(event) => setCronExpression(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Next run at"
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Priority"
                    type="number"
                    value={priority}
                    onChange={(event) => setPriority(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Max attempts"
                    type="number"
                    value={maxAttempts}
                    onChange={(event) => setMaxAttempts(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                {type === "DELAYED" ? (
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Delay seconds"
                      type="number"
                      value={delaySeconds}
                      onChange={(event) => setDelaySeconds(Number(event.target.value))}
                      fullWidth
                    />
                  </Grid>
                ) : null}
                {type === "SCHEDULED" ? (
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Scheduled for"
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(event) => setScheduledFor(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Grid>
                ) : null}
                {type === "BATCH" ? (
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Batch size"
                      type="number"
                      value={batchCount}
                      onChange={(event) => setBatchCount(Number(event.target.value))}
                      fullWidth
                    />
                  </Grid>
                ) : null}
              </>
            )}
            <Grid item xs={12}>
              <TextField
                label="Payload JSON"
                value={payloadText}
                onChange={(event) => setPayloadText(event.target.value)}
                error={Boolean(payloadError)}
                helperText={payloadError || "Must be a JSON object"}
                minRows={7}
                multiline
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" disabled={!props.project || !queueId} onClick={submit}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RegisterWorkerDialog(props: {
  open: boolean;
  project: Project | null;
  queues: Queue[];
  onClose: () => void;
  onCreate: (body: {
    projectId: string;
    queueId?: string;
    name: string;
    hostname?: string;
    concurrency: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [queueId, setQueueId] = useState("");
  const [concurrency, setConcurrency] = useState(5);

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Register Worker</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {!props.project ? (
            <Alert severity="warning">Select or create a project first.</Alert>
          ) : null}
          <TextField
            label="Worker name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
          />
          <TextField
            label="Hostname"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            fullWidth
          />
          <TextField
            label="Queue scope"
            value={queueId}
            onChange={(event) => setQueueId(event.target.value)}
            select
            fullWidth
          >
            <MenuItem value="">All project queues</MenuItem>
            {props.queues.map((queue) => (
              <MenuItem key={queue.id} value={queue.id}>
                {queue.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Concurrency"
            type="number"
            value={concurrency}
            onChange={(event) => setConcurrency(Number(event.target.value))}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!props.project || !name.trim()}
          onClick={() =>
            props.project
              ? void props.onCreate({
                  projectId: props.project.id,
                  queueId: queueId || undefined,
                  name,
                  hostname: hostname || undefined,
                  concurrency
                })
              : undefined
          }
        >
          Register
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Panel(props: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper className="panel" variant="outlined">
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={900}>
          {props.title}
        </Typography>
        {props.action}
      </Stack>
      {props.children}
    </Paper>
  );
}

function SimpleTable<T extends { id: string }>(props: {
  rows: T[];
  columns: Array<{
    label: string;
    align?: "left" | "right" | "center";
    render: (row: T) => ReactNode;
  }>;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (props.rows.length === 0) {
    return <EmptyState title={props.emptyTitle} description={props.emptyDescription} />;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {props.columns.map((column) => (
            <TableCell key={column.label} align={column.align}>
              {column.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {props.rows.map((row) => (
          <TableRow key={row.id} hover>
            {props.columns.map((column) => (
              <TableCell key={column.label} align={column.align}>
                {column.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState(props: { title: string; description?: string }) {
  return (
    <Box className="empty-state">
      <Typography fontWeight={900}>{props.title}</Typography>
      {props.description ? (
        <Typography variant="body2" color="text.secondary">
          {props.description}
        </Typography>
      ) : null}
    </Box>
  );
}

function StatusChip(props: { label: string }) {
  return (
    <Chip
      className={`status-chip status-${props.label.toLowerCase()}`}
      label={props.label}
      size="small"
    />
  );
}

function MetricLine(props: { label: string; value: string | number }) {
  return (
    <Box className="metric-line">
      <Typography color="text.secondary">{props.label}</Typography>
      <Typography variant="h5" fontWeight={900}>
        {props.value}
      </Typography>
    </Box>
  );
}

function SnackView(props: { snack: Snack | null; onClose: () => void }) {
  return (
    <Snackbar
      open={Boolean(props.snack)}
      autoHideDuration={3500}
      onClose={props.onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert severity={props.snack?.severity ?? "info"} onClose={props.onClose} variant="filled">
        {props.snack?.message}
      </Alert>
    </Snackbar>
  );
}

const createJob = async (body: CreateJobInput) => {
  const scheduledIso = body.scheduledFor ? new Date(body.scheduledFor).toISOString() : "";

  if (body.type === "DELAYED") {
    return api.createDelayedJob(body);
  }
  if (body.type === "SCHEDULED") {
    return api.createScheduledJob({ ...body, scheduledFor: scheduledIso });
  }
  if (body.type === "RECURRING") {
    return api.createRecurringJob({
      projectId: body.projectId,
      queueId: body.queueId,
      name: body.recurringName || "Recurring job",
      cronExpression: body.cronExpression,
      timezone: body.timezone,
      payload: body.payload,
      nextRunAt: scheduledIso
    });
  }
  if (body.type === "BATCH") {
    return api.createBatchJob({
      projectId: body.projectId,
      queueId: body.queueId,
      priority: body.priority,
      payload: body.payload,
      maxAttempts: body.maxAttempts,
      count: body.batchCount
    });
  }

  return api.createImmediateJob(body);
};

const chartFromStates = (states: Record<JobState, number>) =>
  Object.entries(states).map(([state, count]) => ({
    state: state as JobState,
    count
  }));

const parsePayload = (value: string) => {
  const payload = JSON.parse(value) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload must be a JSON object");
  }

  return payload as Record<string, unknown>;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const formatDuration = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value} ms`;
};

const toSlug = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
