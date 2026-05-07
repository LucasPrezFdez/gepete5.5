"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AddToListButton() {
  const [added, setAdded] = useState(false);

  return (
    <Button
      variant={added ? "secondary" : "primary"}
      onClick={() => setAdded((value) => !value)}
      aria-pressed={added}
    >
      {added ? "En mi lista" : "Añadir a mi lista"}
    </Button>
  );
}
