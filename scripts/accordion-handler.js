export function initializeAccordions() {
    const accordionState = game.settings.get('mist-hud', 'npcAccordionState');

    document.querySelectorAll('.accordion-container').forEach(container => {
        const accordionHeaders = container.querySelectorAll('.accordion-header');

        accordionHeaders.forEach(header => {
            const content = header.nextElementSibling;

            // Handle initial state
            if (accordionState === 'allExpanded') {
                header.classList.add('active');
                if (content) content.classList.add('active');
            } else if (accordionState === 'allClosed') {
                header.classList.remove('active');
                if (content) content.classList.remove('active');
            } else { // Se não for allExpanded nem allClosed, por padrão fica fechado.
                header.classList.remove('active');
                if (content) content.classList.remove('active');
            }

            // Add click listener
            header.addEventListener('click', () => {
                // Toggle current accordion
                header.classList.toggle('active');
                if (content) content.classList.toggle('active');
                const chevron = header.querySelector('.fa-chevron-left');
                if (chevron) chevron.classList.toggle('rotated');
            });
        });
    });
}