import type { Metadata } from "next";
import BoardClient from "./BoardClient";

export const metadata: Metadata = {
  title: "Tablero Web Gratis — MachineMind",
  robots: { index: false, follow: false },
};

export default function WebGratisBoardPage() {
  return <BoardClient />;
}
