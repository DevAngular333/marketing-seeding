import { createBrowserRouter } from "react-router";
import DashboardApp from "../App";

export const router = createBrowserRouter([
  { path: "*", Component: DashboardApp },
]);
