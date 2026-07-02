import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Toolbar,
  Typography
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReplayIcon from "@mui/icons-material/Replay";
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
import { api } from "@/services/api";
import type { DeadLetterEntry, Job, MetricsOverview, Project, Queue, Worker } from "@/types/api";

type DashboardData = {
  overview: MetricsOverview;
  projects: Project[];
  queues: Queue[];
  jobs: Job[];
  workers: Worker[];
  dlq: DeadLetterEntry[];
};

const jobColors: Record<string, string> = {
  QUEUED: "#146ef5",
  SCHEDULED: "#7c3aed",
  CLAIMED: "#0891b2",
  RUNNING: "#00a676",
  COMPLETED: "#15803d",
  FAILED: "#dc2626",
  RETRYING: "#f59e0b",
  DEAD_LETTER: "#991b1b"
};

const loadDashboardData = async (): Promise<DashboardData> => {
  const [overview, projects, queues, jobs, workers, dlq] = await Promise.all([
    api.metricsOverview(),
    api.projects(),
    api.queues(),
    api.jobs(),
    api.workers(),
    api.deadLetter()
  ]);

  return { overview, projects, queues, jobs, workers, dlq };
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const result = await loadDashboardData();
        if (mounted) {
          setData(result);
          setSelectedJob(result.jobs[0] ?? null);
          setError(null);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
        }
      }
    };

    void load();
    const interval = window.setInterval(load, 15_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const jobChart = useMemo(
    () =>
      Object.entries(data?.overview.jobsByState ?? {}).map(([state, count]) => ({
        state,
        count
      })),
    [data]
  );
  const runningJobs = data?.overview.jobsByState.RUNNING ?? 0;
  const queuedJobs = data?.overview.jobsByState.QUEUED ?? 0;
  const retryingJobs = data?.overview.jobsByState.RETRYING ?? 0;
  const onlineWorkers = data?.overview.workersByStatus.ONLINE ?? 0;

  return (
    <Box className="app-shell">
      <AppBar position="sticky" color="inherit" elevation={0}>
        <Toolbar className="topbar">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <DashboardIcon color="primary" />
            <Typography variant="h6" fontWeight={900}>
              Distributed Job Scheduler
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" href="/metrics" target="_blank">
              Prometheus
            </Button>
            <Button size="small" variant="contained" href="/health" target="_blank">
              Health
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" className="main-content">
        <Stack spacing={3}>
          {error ? <Alert severity="warning">{error}</Alert> : null}
          {!data ? <LinearProgress /> : null}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<ListAltIcon />}
                label="Queued Jobs"
                value={queuedJobs}
                helper={`${retryingJobs} retrying`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<PrecisionManufacturingIcon />}
                label="Running Jobs"
                value={runningJobs}
                helper={`${onlineWorkers} online workers`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<ErrorOutlineIcon />}
                label="Dead Letter"
                value={data?.overview.dlqCount ?? 0}
                helper="permanent failures"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<QueryStatsIcon />}
                label="Success Rate"
                value={`${Math.round((data?.overview.successRate ?? 0) * 100)}%`}
                helper="terminal jobs"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <Paper className="panel" variant="outlined">
                <Typography variant="h6" fontWeight={900} mb={2}>
                  Metrics
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer>
                    <BarChart data={jobChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {jobChart.map((item) => (
                          <Cell key={item.state} fill={jobColors[item.state] ?? "#146ef5"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Paper className="panel" variant="outlined">
                <Typography variant="h6" fontWeight={900} mb={2}>
                  Projects
                </Typography>
                <Stack spacing={1.5}>
                  {(data?.projects ?? []).map((project) => (
                    <Box className="row-card" key={project.id}>
                      <Box>
                        <Typography fontWeight={800}>{project.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {project.organization.name}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip label={`${project._count.queues} queues`} size="small" />
                        <Chip label={`${project._count.jobs} jobs`} size="small" />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              <DataTable
                title="Queues"
                rows={data?.queues ?? []}
                columns={["name", "status", "concurrencyLimit", "priorityWeight"]}
              />
            </Grid>
            <Grid item xs={12} lg={6}>
              <DataTable
                title="Workers"
                rows={data?.workers ?? []}
                columns={["name", "status", "concurrency", "lastHeartbeatAt"]}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={8}>
              <Paper className="panel" variant="outlined">
                <Typography variant="h6" fontWeight={900} mb={2}>
                  Jobs
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Queue</TableCell>
                      <TableCell>Attempts</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.jobs ?? []).slice(0, 12).map((job) => (
                      <TableRow key={job.id} hover selected={selectedJob?.id === job.id}>
                        <TableCell>{job.type}</TableCell>
                        <TableCell>
                          <Chip label={job.state} size="small" />
                        </TableCell>
                        <TableCell>{job.queue?.name ?? job.queueId}</TableCell>
                        <TableCell>
                          {job.attempts}/{job.maxAttempts}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setSelectedJob(job)}>
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Paper className="panel" variant="outlined">
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={900}>
                    Job Details
                  </Typography>
                  <Button size="small" startIcon={<ReplayIcon />}>
                    Retry
                  </Button>
                </Stack>
                {selectedJob ? (
                  <Stack spacing={1}>
                    <Typography fontWeight={800}>{selectedJob.id}</Typography>
                    <Chip label={selectedJob.state} className="fit-chip" />
                    <Typography variant="body2" color="text.secondary">
                      Priority {selectedJob.priority} · Attempts {selectedJob.attempts}/
                      {selectedJob.maxAttempts}
                    </Typography>
                    <Typography variant="body2">
                      {selectedJob.errorMessage ?? "No error recorded"}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">No job selected</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          <DataTable
            title="Dead Letter Queue"
            rows={data?.dlq ?? []}
            columns={["reason", "failureMessage", "failedAt"]}
          />
        </Stack>
      </Container>
    </Box>
  );
}

function DataTable<T extends { id: string }>(props: {
  title: string;
  rows: T[];
  columns: Array<keyof T & string>;
}) {
  return (
    <Paper className="panel" variant="outlined">
      <Typography variant="h6" fontWeight={900} mb={2}>
        {props.title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {props.columns.map((column) => (
              <TableCell key={column}>{column}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {props.rows.slice(0, 10).map((row) => (
            <TableRow key={row.id}>
              {props.columns.map((column) => (
                <TableCell key={column}>{formatCell(row[column])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

const formatCell = (value: unknown) => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string" && value.includes("T")) {
    return new Date(value).toLocaleString();
  }
  return String(value);
};
