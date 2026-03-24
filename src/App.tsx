import { Routes, Route, Navigate } from "react-router-dom";
import HouseholdLayout from "./layouts/HouseholdLayout";
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
import PaprikaImport from "./pages/PaprikaImport";
import RecipeLibrary from "./pages/RecipeLibrary";
import RecipeIdRedirect from "./pages/RecipeIdRedirect";
import Settings from "./pages/Settings";
import AcceptInvite from "./pages/AcceptInvite";
import { loadHouseholds, loadDefaultHouseholdId } from "./storage";

function DefaultRoute() {
  const households = loadHouseholds();
  const storedDefaultId = loadDefaultHouseholdId();
  const hasStoredDefault = storedDefaultId
    ? households.some((household) => household.id === storedDefaultId)
    : false;
  const targetHouseholdId = hasStoredDefault ? storedDefaultId : households[0]?.id;
  if (!targetHouseholdId) {
    return <HouseholdList />;
  }
  return <Navigate to={`/household/${targetHouseholdId}/home`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRoute />} />
      <Route path="/invite/:code" element={<AcceptInvite />} />
      <Route path="/households" element={<HouseholdList />} />
      <Route path="/household/new" element={<HouseholdSetup />} />
      <Route path="/household/:householdId" element={<HouseholdLayout />}>
        <Route index element={<HouseholdSetup />} />
        <Route path="home" element={<Home />} />
        <Route path="member/:memberId" element={<MemberProfile />} />
        <Route path="ingredients" element={<IngredientManager />} />
        <Route path="meals" element={<BaseMealManager />} />
        <Route path="recipes" element={<RecipeLibrary />} />
        <Route path="recipes/:recipeId" element={<RecipeIdRedirect />} />
        <Route path="meal/:mealId" element={<MealDetail />} />
        <Route path="planner" element={<Planner />} />
        <Route path="weekly" element={<WeeklyPlanner />} />
        <Route path="grocery" element={<GroceryList />} />
        <Route path="rescue" element={<RescueMode />} />
        <Route path="history" element={<MealHistory />} />
        <Route path="import-recipe" element={<RecipeImport />} />
        <Route path="import-paprika" element={<PaprikaImport />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
