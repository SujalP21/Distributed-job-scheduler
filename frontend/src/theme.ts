import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#146ef5"
    },
    secondary: {
      main: "#00a676"
    },
    background: {
      default: "#f7f9fc",
      paper: "#ffffff"
    },
    text: {
      primary: "#172033",
      secondary: "#5c667a"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: {
      letterSpacing: 0
    },
    button: {
      textTransform: "none",
      fontWeight: 700
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderColor: "#dfe5ef"
        }
      }
    }
  }
});
