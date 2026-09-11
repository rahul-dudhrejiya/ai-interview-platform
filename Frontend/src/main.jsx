import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/constants.js";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
// BUG FIX: original imported from './app/store.js' but the redux store
// actually lives at './redux/store.js' - wrong folder name, module
// wouldn't resolve at all.
import { store } from "./redux/store.js";
import { Provider } from "react-redux";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <App />
      </Provider>
    </BrowserRouter>
  </StrictMode>
);