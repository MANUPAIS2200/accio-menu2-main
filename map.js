document.addEventListener("DOMContentLoaded", () => {
  const map = document.getElementById("marauders-map");

  if (!map) return;

  map.addEventListener("click", () => {
    map.classList.toggle("active");
    setTimeout(() => {
  const wrapper = document.querySelector(".map-wrapper");
  wrapper.scrollLeft = (wrapper.scrollWidth - wrapper.clientWidth) / 2;
}, 300);
  });
});