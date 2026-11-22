import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Deck } from "./deck";
import { Presenter } from "./presenter";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>{location.hash.startsWith("#presenter") ? <Presenter /> : <Deck />}</StrictMode>,
  );
}
