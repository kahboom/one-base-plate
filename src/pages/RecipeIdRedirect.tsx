import { Navigate, useParams } from 'react-router-dom';

/** Old deep links `/recipes/:id` → query param handled by RecipeLibrary. */
export default function RecipeIdRedirect() {
  const { householdId, recipeId } = useParams<{
    householdId: string;
    recipeId: string;
  }>();
  if (!householdId || !recipeId) {
    return <Navigate to="/households" replace />;
  }
  return (
    <Navigate
      to={`/household/${householdId}/recipes?recipe=${encodeURIComponent(recipeId)}`}
      replace
    />
  );
}
