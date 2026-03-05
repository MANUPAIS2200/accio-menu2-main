document.addEventListener("DOMContentLoaded", () => {
  const map = document.getElementById("marauders-map");
  const wrapper = document.querySelector(".map-wrapper");
  if (!map || !wrapper) return;

  const syncOpenState = () => {
    const isActive = map.classList.contains("active");
    wrapper.classList.toggle("is-open", isActive);

    // centrar el "libro" en  al abrir
    if (isActive) {
      window.setTimeout(() => {
        wrapper.scrollLeft = (wrapper.scrollWidth - wrapper.clientWidth) / 2;
      }, 350);
    }
  };

  // click/tap
  map.addEventListener("click", (e) => {
    // si querés que al tocar dentro del menú NO cierre, descomentá:
    // if (e.target.closest(".menu-panel")) return;

    map.classList.toggle("active");
    syncOpenState();
  });

  // por si refresca con active (o cambia algo)
  syncOpenState();
});