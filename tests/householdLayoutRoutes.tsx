import { Route } from 'react-router-dom';
import HouseholdLayout from '../src/layouts/HouseholdLayout';
import HouseholdSetup from '../src/pages/HouseholdSetup';
import Home from '../src/pages/Home';
import Planner from '../src/pages/Planner';
import WeeklyPlanner from '../src/pages/WeeklyPlanner';
import GroceryList from '../src/pages/GroceryList';
import RescueMode from '../src/pages/RescueMode';
import MealDetail from '../src/pages/MealDetail';
import IngredientManager from '../src/pages/IngredientManager';
import BaseMealManager from '../src/pages/BaseMealManager';
import MealHistory from '../src/pages/MealHistory';
import MemberProfile from '../src/pages/MemberProfile';
import RecipeImport from '../src/pages/RecipeImport';
import PaprikaImport from '../src/pages/PaprikaImport';
import Settings from '../src/pages/Settings';

/** Mirrors `App.tsx` household branch for MemoryRouter tests */
export const householdLayoutRouteBranch = (
  <Route path="/household/:householdId" element={<HouseholdLayout />}>
    <Route index element={<HouseholdSetup />} />
    <Route path="home" element={<Home />} />
    <Route path="member/:memberId" element={<MemberProfile />} />
    <Route path="ingredients" element={<IngredientManager />} />
    <Route path="meals" element={<BaseMealManager />} />
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
);
