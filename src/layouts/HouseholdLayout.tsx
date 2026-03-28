import { Outlet, useParams } from 'react-router-dom';
import { AppHeader, HouseholdNavStack } from '../components/ui';

/**
 * Shared shell for all /household/:householdId/* screens (PRD F053).
 * Renders global and secondary navigation once so pages cannot omit section nav.
 */
export default function HouseholdLayout() {
  const { householdId } = useParams<{ householdId: string }>();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <AppHeader />
      <HouseholdNavStack householdId={householdId} />
      <Outlet />
    </div>
  );
}
