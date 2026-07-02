const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = {
  async health() {
    const response = await fetch(`${API_URL}/health`);

    if (!response.ok) {
      throw new Error(`Health request failed with status ${response.status}`);
    }

    return response.json();
  }
};
