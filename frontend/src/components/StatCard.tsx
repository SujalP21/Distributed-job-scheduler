import { Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper?: string;
};

export function StatCard({ icon, label, value, helper }: StatCardProps) {
  return (
    <Paper className="stat-card" variant="outlined">
      <Stack direction="row" spacing={1.5} alignItems="center">
        <span className="stat-icon">{icon}</span>
        <span>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={900}>
            {value}
          </Typography>
          {helper ? (
            <Typography variant="caption" color="text.secondary">
              {helper}
            </Typography>
          ) : null}
        </span>
      </Stack>
    </Paper>
  );
}
