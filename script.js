// MegaNathan interactions


// Scroll reveal animations

const elements = document.querySelectorAll(
    "section, .card, .project-card"
);


const observer = new IntersectionObserver(
    (entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                entry.target.classList.add("show");

            }

        });

    },
    {
        threshold: 0.15
    }
);



elements.forEach(element => {

    element.classList.add("hidden");

    observer.observe(element);

});





// Neon cursor effect

const cursor = document.createElement("div");

cursor.className = "cursor-glow";

document.body.appendChild(cursor);



document.addEventListener(
    "mousemove",
    (e) => {

        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";

    }
);





// Highlight current navigation section

const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-links a");


window.addEventListener("scroll", () => {

    let current = "";

    sections.forEach(section => {

        const top = section.offsetTop - 200;

        if (window.scrollY >= top) {

            current = section.id;

        }

    });


    navLinks.forEach(link => {

        link.style.color = "";


        if (link.href.includes(current)) {

            link.style.color = "#00d9ff";

        }

    });

});
