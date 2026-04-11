export async function fetchDisasters() {
  const response = await fetch("http://localhost:5001/api/disasters")
  return await response.json()
}

export async function fetchRisk() {
  const response = await fetch("http://localhost:5001/api/risk")
  return await response.json()
}
