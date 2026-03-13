import { Routes, Route } from "react-router-dom";
import HouseholdList from "./pages/HouseholdList";
import HouseholdSetup from "./pages/HouseholdSetup";
import MemberProfile from "./pages/MemberProfile";
import IngredientManager from "./pages/IngredientManager";
import BaseMealManager from "./pages/BaseMealManager";
import Planner from "./pages/Planner";
import WeeklyPlanner from "./pages/WeeklyPlanner";
import Home from "./pages/Home";
import MealDetail from "./pages/MealDetail";
import GroceryList from "./pages/GroceryList";
import RescueMode from "./pages/RescueMode";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HouseholdList />} />
      <Route path="/household/:householdId/home" element={<Home />} />
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
      <Route
        path="/household/:householdId/meal/:mealId"
        element={<MealDetail />}
      />
      <Route
        path="/household/:householdId/planner"
        element={<Planner />}
      />
      <Route
        path="/household/:householdId/weekly"
        element={<WeeklyPlanner />}
      />
      <Route
        path="/household/:householdId/grocery"
        element={<GroceryList />}
      />
      <Route
        path="/household/:householdId/rescue"
        element={<RescueMode />}
      />
    </Routes>
  );
}

export default App;
