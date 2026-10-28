import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStartDay } from "../services/settings";
import { periodFor } from "./period";

/** Mes fiscal atual (ou deslocado por `offset`), conforme o dia de inicio configurado nos Ajustes. */
export function usePeriod() {
  const [offset, setOffset] = useState(0);
  const { data: startDay, isLoading } = useQuery({ queryKey: ["start-day"], queryFn: getStartDay });
  const period = startDay ? periodFor(new Date(), startDay, offset) : null;
  return { period, offset, setOffset, isLoading, startDay };
}
