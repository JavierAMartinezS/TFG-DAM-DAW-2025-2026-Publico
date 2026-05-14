(function () {
    const button = document.getElementById("tpScrollTop");
    if (!button) return;

    const toggle = () => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        button.classList.toggle("is-visible", y > 280);
    };

    window.addEventListener("scroll", toggle, { passive: true });
    toggle();

    button.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
})();

