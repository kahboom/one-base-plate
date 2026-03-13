import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHouseholds, deleteHousehold } from "../storage";

export default function HouseholdList() {
  const [households, setHouseholds] = useState<Household[]>([]);

  useEffect(() => {
    setHouseholds(loadHouseholds());
  }, []);

  function handleDelete(id: string) {
    deleteHousehold(id);
    setHouseholds(loadHouseholds());
  }

  return (
    <div>
      <h1>OneBasePlate</h1>
      <p>One base meal, multiple household-specific assemblies.</p>

      <h2>Households</h2>
      <Link to="/household/new">
        <button type="button">Create Household</button>
      </Link>

      {households.length === 0 && <p>No households yet. Create one to get started.</p>}

      <ul>
        {households.map((h) => (
          <li key={h.id}>
            <Link to={`/household/${h.id}/home`}>{h.name}</Link>
            {" "}({h.members.length} member{h.members.length !== 1 ? "s" : ""})
            {" "}
            <Link to={`/household/${h.id}`}>Setup</Link>
            {" "}
            <button type="button" onClick={() => handleDelete(h.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
