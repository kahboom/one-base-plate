import { Routes, Route } from "react-router-dom";
import HouseholdList from "./pages/HouseholdList";
import HouseholdSetup from "./pages/HouseholdSetup";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HouseholdList />} />
      <Route path="/household/:id" element={<HouseholdSetup />} />
    </Routes>
  );
}

export default App;
