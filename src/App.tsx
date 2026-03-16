import { Routes, Route, Navigate } from "react-router-dom";
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
import MealHistory from "./pages/MealHistory";
import RecipeImport from "./pages/RecipeImport";
import { loadHouseholds } from "./storage";

function DefaultRoute() {
  const households = loadHouseholds();
  const firstHouseholdId = households[0]?.id;
  if (!firstHouseholdId) {
    return <HouseholdList />;
  }
  return <Navigate to={`/household/${firstHouseholdId}/home`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRoute />} />
      <Route path="/households" element={<HouseholdList />} />
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
      <Route
        path="/household/:householdId/history"
        element={<MealHistory />}
      />
      <Route
        path="/household/:householdId/import-recipe"
        element={<RecipeImport />}
      />
    </Routes>
  );
}

export default App;
