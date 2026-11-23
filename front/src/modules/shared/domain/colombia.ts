// Colombia as the store asks for it: identity documents and departments (with the codes orders always used).

export const documentTypes = [
  { value: "CC", label: "Cédula de ciudadanía" }, { value: "NIT", label: "NIT" }, { value: "CE", label: "Cédula de extranjería" }, { value: "PA", label: "Pasaporte" }, { value: "TI", label: "Tarjeta de identidad" },
] as const

/** Departments with the codes the orders have always used (ISO 3166-2:CO). */
export const departments: { code: string; name: string }[] = [
  ["CO-DC", "Bogotá, D. C."], ["CO-AMA", "Amazonas"], ["CO-ANT", "Antioquia"], ["CO-ARA", "Arauca"], ["CO-ATL", "Atlántico"], ["CO-BOL", "Bolívar"], ["CO-BOY", "Boyacá"], ["CO-CAL", "Caldas"],
  ["CO-CAQ", "Caquetá"], ["CO-CAS", "Casanare"], ["CO-CAU", "Cauca"], ["CO-CES", "Cesar"], ["CO-CHO", "Chocó"], ["CO-COR", "Córdoba"], ["CO-CUN", "Cundinamarca"], ["CO-GUA", "Guainía"],
  ["CO-GUV", "Guaviare"], ["CO-HUI", "Huila"], ["CO-LAG", "La Guajira"], ["CO-MAG", "Magdalena"], ["CO-MET", "Meta"], ["CO-NAR", "Nariño"], ["CO-NSA", "Norte de Santander"], ["CO-PUT", "Putumayo"],
  ["CO-QUI", "Quindío"], ["CO-RIS", "Risaralda"], ["CO-SAP", "San Andrés y Providencia"], ["CO-SAN", "Santander"], ["CO-SUC", "Sucre"], ["CO-TOL", "Tolima"], ["CO-VAC", "Valle del Cauca"], ["CO-VAU", "Vaupés"], ["CO-VID", "Vichada"],
].map(([code, name]) => ({ code, name }))

/** "Antioquia" for "CO-ANT"; the code itself when it is not one of them (older orders). */
export const departmentName = (code: string | null | undefined) => departments.find((d) => d.code === code)?.name ?? code ?? ""
