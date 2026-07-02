import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Toolbar,
  Typography
} from "@mui/material";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import StorageIcon from "@mui/icons-material/Storage";
import MemoryIcon from "@mui/icons-material/Memory";
import WorkspacesIcon from "@mui/icons-material/Workspaces";

const metrics = [
  { label: "API Runtime", value: "Ready", icon: <HealthAndSafetyIcon /> },
  { label: "Postgres", value: "Configured", icon: <StorageIcon /> },
  { label: "Redis", value: "Configured", icon: <MemoryIcon /> },
  { label: "Scheduler Core", value: "Phase 1", icon: <WorkspacesIcon /> }
];

export default function App() {
  return (
    <Box className="app-shell">
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar className="topbar">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <WorkspacesIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              Distributed Job Scheduler
            </Typography>
          </Stack>
          <Button variant="contained" href="/health" target="_blank" rel="noreferrer">
            Health
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" className="main-content">
        <Stack spacing={3}>
          <Box>
            <Chip label="Runtime foundation" color="primary" variant="outlined" />
            <Typography variant="h3" fontWeight={900} mt={2} maxWidth={760}>
              Production-grade scheduler platform foundation
            </Typography>
            <Typography variant="body1" color="text.secondary" mt={1.5} maxWidth={720}>
              Backend, database, cache, logging, environment validation, health reporting, and
              frontend shell are ready for the identity and scheduler modules.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {metrics.map((metric) => (
              <Grid item xs={12} sm={6} md={3} key={metric.label}>
                <Paper className="metric-card" variant="outlined">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box className="metric-icon">{metric.icon}</Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {metric.label}
                      </Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {metric.value}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper className="status-panel" variant="outlined">
            <Typography variant="h6" fontWeight={800}>
              Next checkpoint
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Phase 2 will add users, organizations, JWT authentication, refresh tokens, validation,
              and protected middleware after this phase is approved.
            </Typography>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
