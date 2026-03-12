import { Routes, Route } from "react-router-dom";
import HouseholdList from "./pages/HouseholdList";
import HouseholdSetup from "./pages/HouseholdSetup";
import MemberProfile from "./pages/MemberProfile";
import IngredientManager from "./pages/IngredientManager";
import BaseMealManager from "./pages/BaseMealManager";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HouseholdList />} />
      <Route path="/household/:id" element={<HouseholdSetup />} />
      <Route
        path="/household/:householdId/member/:memberId"
        element={<MemberProfile />}
      />
      <Route
        path="/household/:householdId/ingredients"
        element={<IngredientManager />}
      />
      <Route
        path="/household/:householdId/meals"
        element={<BaseMealManager />}
      />
    </Routes>
  );
}

export default App;
