export function initializeAccordions() {
    // const onlyOneOpen = game.settings.get('mist-hud', 'onlyOneOpen');
    const accordionState = game.settings.get('mist-hud', 'npcAccordionState');

    document.querySelectorAll('.accordion-container').forEach(container => {
        const accordionHeaders = container.querySelectorAll('.accordion-header');

        accordionHeaders.forEach(header => {
            const content = header.nextElementSibling;

            // Handle initial state
            if (accordionState === 'allExpanded') {
                header.classList.add('active');
                if (content) content.classList.add('active');
            } else if (accordionState === 'onlyMovesExpanded' && header.classList.contains('start-expanded')) {
                header.classList.add('active');
                if (content) content.classList.add('active');
            } else if (accordionState === 'allClosed') {
                header.classList.remove('active');
                if (content) content.classList.remove('active');
            }

            // Add click listener
            header.addEventListener('click', () => {
                // if (onlyOneOpen) {
                //     accordionHeaders.forEach(otherHeader => {
                //         if (otherHeader !== header) {
                //             otherHeader.classList.remove('active');
                //             const otherContent = otherHeader.nextElementSibling;
                //             if (otherContent) otherContent.classList.remove('active');
                //             const otherChevron = otherHeader.querySelector('.fa-chevron-left');
                //             if (otherChevron) otherChevron.classList.remove('rotated');
                //         }
                //     });
                // }

                // Toggle current accordion
                header.classList.toggle('active');
                if (content) content.classList.toggle('active');
                const chevron = header.querySelector('.fa-chevron-left');
                if (chevron) chevron.classList.toggle('rotated');
            });
        });
    });
}
