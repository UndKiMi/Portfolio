export function isCacheValid(lastFetch, duration) {
  return lastFetch && Date.now() - lastFetch < duration;
}

