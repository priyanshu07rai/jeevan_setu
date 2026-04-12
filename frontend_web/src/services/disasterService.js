export async function fetchDisasters() {
  const response = await fetch("https://jeevansetu-api.onrender.com/api/disasters")
  return await response.json()
}

export async function fetchRisk() {
  const response = await fetch("https://jeevansetu-api.onrender.com/api/risk")
  return await response.json()
}
