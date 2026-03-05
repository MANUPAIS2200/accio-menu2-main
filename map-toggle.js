document.addEventListener("DOMContentLoaded", () => {
  const map = document.getElementById("marauders-map");
  if (!map) return;

  map.addEventListener("click", () => {
    map.classList.toggle("active");
  });
});