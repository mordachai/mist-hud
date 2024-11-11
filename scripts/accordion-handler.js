export function initializeAccordions() {
    const onlyOneOpen = game.settings.get('mist-hud', 'onlyOneOpen');
    const accordionState = game.settings.get('mist-hud', 'npcAccordionState');

    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        // Handle initial state based on settings
        if (accordionState === 'allExpanded') {
            header.classList.add('active');
            const content = header.nextElementSibling;
            if (content) content.classList.add('active');
        } else if (accordionState === 'onlyMovesExpanded' && header.classList.contains('start-expanded')) {
            header.classList.add('active');
            const content = header.nextElementSibling;
            if (content) content.classList.add('active');
        } else if (accordionState === 'allClosed') {
            header.classList.remove('active');
            const content = header.nextElementSibling;
            if (content) content.classList.remove('active');
        }

        header.addEventListener('click', () => {
            if (onlyOneOpen) {
                accordionHeaders.forEach(otherHeader => {
                    if (otherHeader !== header) {
                        otherHeader.classList.remove('active');
                        if (otherHeader.nextElementSibling) {
                            otherHeader.nextElementSibling.classList.remove('active');
                            const otherChevron = otherHeader.querySelector('.fas-chevron-left');
                            if (otherChevron) {
                                otherChevron.classList.remove('rotated');
                            }
                        }
                    }
                });
            }

            // Toggle current accordion
            header.classList.toggle('active');
            const content = header.nextElementSibling;
            const chevron = header.querySelector('.fa-chevron-left');
            if (content) {
                if (header.classList.contains('active')) {
                    content.classList.add('active');
                    if (chevron) chevron.classList.add('rotated');
                } else {
                    content.classList.remove('active');
                    if (chevron) chevron.classList.remove('rotated');
                }
            }
        });
    });
}