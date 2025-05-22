(function() {
    window.PDFViewerApplication = {
        pageNum: 1,
        pdfScale: 1,
        shownPdf: null,
        url: '',

        __PDF_DOC: null,
        __CURRENT_PAGE: 0, 
        __TOTAL_PAGES: 0,
        __PAGE_RENDERING_IN_PROGRESS: 0, 

        __CANVAS: null,
        __CANVAS_CTX: null,

        widthCanvas: 0, 
        heightCanvas: 0, 
        drawCanvas: null, 
        drawContext: null,

        canvasWidthOringin: 0, 
        canvasHeightOringin: 0, 
        cont: 0, // Counter for setting PDF original dimensions once

        arrayImageData: [], 

        // Drawing state variables will remain on the main App object
        canvas: null, // Reference to the drawing canvas element (App.drawCanvas)
        ctx: null,    // Drawing context (App.drawContext)
        flag: false,
        prevX: 0,
        currX: 0,
        prevY: 0,
        currY: 0,
        dot_flag: false,
        x: "black", // Current color
        y: 2,       // Current line width
    };

    var App = window.PDFViewerApplication; // Shorthand
    App.DrawingTool = {}; // Define the DrawingTool namespace

    async function showPDF(pdf_url) {
        App.url = pdf_url; 
        App.pdfScale = 1; 
        App.shownPdf = null;
        App.__PDF_DOC = null;
        App.__TOTAL_PAGES = 0;
        App.pageNum = 1;
        App.cont = 0; 
        App.arrayImageData = []; 
        
        if (App.drawContext) {
            App.drawContext.clearRect(0, 0, App.drawCanvas.width, App.drawCanvas.height);
        }
        const pdfCurrentPageElem = document.getElementById("pdf-current-page");
        const pdfTotalPagesElem = document.getElementById("pdf-total-pages");
        if (pdfCurrentPageElem) pdfCurrentPageElem.textContent = '0';
        if (pdfTotalPagesElem) pdfTotalPagesElem.textContent = '0';

        try {
            const pdf = await PDFJS.getDocument(pdf_url).promise;
            App.__PDF_DOC = pdf;
            App.shownPdf = pdf; 
            App.__TOTAL_PAGES = pdf.numPages;

            if (pdfTotalPagesElem) pdfTotalPagesElem.textContent = App.__TOTAL_PAGES;
            if (pdfCurrentPageElem) pdfCurrentPageElem.textContent = '1'; 

            for(var i = 0; i < App.__TOTAL_PAGES; i++) { 
                App.arrayImageData.push({ numPage: i + 1, dataImage: '' });
            }
            
            App.pageNum = 1; 
            await displayPage(App.shownPdf, App.pageNum);

        } catch (error) {
            // console.error('Error loading PDF:', error); // Original console.error before the alert
            console.error('Error loading PDF: ', error.message); // As per subtask instruction
            
            const controlPdfElem = document.getElementById("controlpdf");
            const pageCountContainerElem = document.getElementById("page-count-container");
            if (controlPdfElem) controlPdfElem.style.visibility = 'hidden';
            if (pageCountContainerElem) pageCountContainerElem.style.visibility = 'hidden';
            
            const fileToUploadElem = document.getElementById("file-to-upload");
            if (fileToUploadElem) fileToUploadElem.value = ''; 
        }
    }

    async function renderPage(page) {
        App.__PAGE_RENDERING_IN_PROGRESS = 1;
        var scale = App.pdfScale;
        var viewport = page.getViewport({ scale: scale });
        
        App.drawCanvas = App.__CANVAS; 
        App.drawContext = App.__CANVAS_CTX;
        App.canvas = App.drawCanvas; // Ensure drawing tool uses the correct canvas
        App.ctx = App.drawContext;   // Ensure drawing tool uses the correct context

        App.drawCanvas.height = viewport.height;
        App.drawCanvas.width = viewport.width;
        App.heightCanvas = viewport.height; 
        App.widthCanvas = viewport.width;

        if ( App.cont < 1 ) { 
            App.canvasHeightOringin = viewport.height * (25.4 / 96); 
            App.canvasWidthOringin = viewport.width * (25.4 / 96);
            App.cont++;
        }

        var renderContext = {
            canvasContext: App.drawContext,
            viewport: viewport
        };
        
        try {
            await page.render(renderContext).promise;
            const controlPdfElem = document.getElementById("controlpdf");
            const pageCountContainerElem = document.getElementById("page-count-container");
            if (controlPdfElem) controlPdfElem.style.visibility = 'visible';
            if (pageCountContainerElem) pageCountContainerElem.style.visibility = 'visible';
            App.DrawingTool.init(); // Updated call
        } catch (error) {
            // console.error('Error rendering page:', error); // Original console.error before the alert
            console.error('Error rendering page ' + page.pageNumber + ': ', error.message);
        } finally {
            App.__PAGE_RENDERING_IN_PROGRESS = 0;
        }
    }

    async function displayPage(pdfDoc, num) {
        if (!pdfDoc || num < 1 || num > pdfDoc.numPages) {
            console.error("Invalid page number or PDF document not loaded.");
            return;
        }
        App.pageNum = num; 
        const pdfCurrentPageElem = document.getElementById("pdf-current-page");
        if (pdfCurrentPageElem) pdfCurrentPageElem.textContent = num;

        try {
            const page = await pdfDoc.getPage(num);
            await renderPage(page);
        } catch (error) {
            console.error('Error displaying page ' + num + ':', error);
        }
    }
    
    function drawCachedImage(dataUrl) {
        var imagen = new Image();
        imagen.onload = function () {
            if (!App.drawCanvas || !App.drawContext) {
                console.error("Canvas or context not available for drawing cached image.");
                return;
            }
            App.drawContext.clearRect(0, 0, App.drawCanvas.width, App.drawCanvas.height);
            App.drawContext.drawImage(imagen, 0, 0, App.drawCanvas.width, App.drawCanvas.height);
        };
        imagen.onerror = function() {
            console.error("Error loading cached image for drawing.");
        }
        imagen.src = dataUrl;
    }
    
    function timeout(ms) { 
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- DrawingTool Methods ---
    App.DrawingTool.init = function() {
        // App.canvas and App.ctx are set in renderPage before this is called
        if (!App.canvas || App.canvas.dataset.drawingInitialized === 'true') return;
        
        App.canvas.dataset.drawingInitialized = 'true'; // Mark as initialized
        // Remove old listeners if any, before adding new ones (optional, good practice)
        // Note: This requires storing bound functions to remove them effectively.
        // For simplicity here, we rely on drawingInitialized flag.

        App.canvas.addEventListener("mousemove", function (e) { App.DrawingTool.findxy('move', e); }, false);
        App.canvas.addEventListener("mousedown", function (e) { App.DrawingTool.findxy('down', e); }, false);
        App.canvas.addEventListener("mouseup", function (e) { App.DrawingTool.findxy('up', e); }, false);
        App.canvas.addEventListener("mouseout", function (e) { App.DrawingTool.findxy('out', e); }, false);
    };

    App.DrawingTool.color = function(obj) { 
        App.x = obj.id; 
        if (obj.id === "white") App.y = 14; 
        else App.y = 2; 
    };

    App.DrawingTool.findxy = function(res, e) {
        if (!App.canvas) return; // App.canvas should be set by renderPage
        const rect = App.canvas.getBoundingClientRect();
        const scaleX = App.canvas.width / rect.width;
        const scaleY = App.canvas.height / rect.height;

        let currentX = (e.clientX - rect.left) * scaleX;
        let currentY = (e.clientY - rect.top) * scaleY;

        if (res === 'down') {
            App.prevX = App.currX;
            App.prevY = App.currY;
            App.currX = currentX;
            App.currY = currentY;

            App.flag = true;
            App.dot_flag = true;
            if (App.dot_flag) {
                App.ctx.beginPath(); // App.ctx should be set by renderPage
                App.ctx.fillStyle = App.x;
                App.ctx.fillRect(App.currX - (App.y / 2), App.currY - (App.y / 2), App.y, App.y); 
                App.ctx.closePath();
                App.dot_flag = false;
            }
        } else if (res === 'up' || res === "out") {
            App.flag = false;
        } else if (res === 'move' && App.flag) {
            App.prevX = App.currX;
            App.prevY = App.currY;
            App.currX = currentX;
            App.currY = currentY;
            App.DrawingTool.draw(); // Updated call
        }
    };

    App.DrawingTool.draw = function() {
        App.ctx.beginPath(); // App.ctx should be set by renderPage
        App.ctx.moveTo(App.prevX, App.prevY);
        App.ctx.lineTo(App.currX, App.currY);
        App.ctx.strokeStyle = App.x;
        App.ctx.lineWidth = App.y;
        App.ctx.stroke();
        App.ctx.closePath();
    };

    App.DrawingTool.erase = async function() { 
        if (App.drawCanvas && App.drawContext) {
            App.drawContext.clearRect(0, 0, App.drawCanvas.width, App.drawCanvas.height);
        }
        
        if (App.shownPdf && App.pageNum >= 1 && App.pageNum <= App.__TOTAL_PAGES) {
            if (App.arrayImageData[App.pageNum - 1]) {
                App.arrayImageData[App.pageNum - 1].dataImage = '';
            }
            // Re-render the current page to show the clean state, which also re-initializes drawing.
            await displayPage(App.shownPdf, App.pageNum); 
        } else {
            const controlPdfElem = document.getElementById("controlpdf");
            const pageCountContainerElem = document.getElementById("page-count-container");
            if (controlPdfElem) controlPdfElem.style.visibility = 'hidden';
            if (pageCountContainerElem) pageCountContainerElem.style.visibility = 'hidden';
            
            const fileToUploadElem = document.getElementById("file-to-upload");
            if (fileToUploadElem) fileToUploadElem.value = '';
            
            const pdfCurrentPageElem = document.getElementById("pdf-current-page");
            const pdfTotalPagesElem = document.getElementById("pdf-total-pages");
            if (pdfCurrentPageElem) pdfCurrentPageElem.textContent = '0';
            if (pdfTotalPagesElem) pdfTotalPagesElem.textContent = '0';
        }
    };
    // --- End of DrawingTool Methods ---

    document.addEventListener('DOMContentLoaded', async function() {
        App.__CANVAS = document.getElementById('the-canvas');
        if (!App.__CANVAS) {
            console.error("#the-canvas element not found. PDF Viewer cannot initialize.");
            return; 
        }
        App.__CANVAS_CTX = App.__CANVAS.getContext('2d');

        var nextbutton = document.getElementById("nextbutton");
        if (nextbutton) {
            nextbutton.addEventListener('click', async function () {
                if (!App.shownPdf || App.pageNum >= App.shownPdf.numPages || App.__PAGE_RENDERING_IN_PROGRESS) {
                    return;
                }
                if (App.drawCanvas) App.arrayImageData[App.pageNum - 1].dataImage = App.drawCanvas.toDataURL("image/jpeg", 1.0);
                
                App.pageNum++;
                document.getElementById("pdf-current-page").textContent = App.pageNum;

                if (App.arrayImageData[App.pageNum - 1].dataImage.length === 0) {
                    await displayPage(App.shownPdf, App.pageNum);
                } else {
                    drawCachedImage(App.arrayImageData[App.pageNum - 1].dataImage);
                    App.DrawingTool.init(); // Updated call
                }
            });
        }

        var prevbutton = document.getElementById("prevbutton");
        if (prevbutton) {
            prevbutton.addEventListener('click', async function () {
                if (!App.shownPdf || App.pageNum <= 1 || App.__PAGE_RENDERING_IN_PROGRESS) {
                    return;
                }
                if (App.drawCanvas) App.arrayImageData[App.pageNum - 1].dataImage = App.drawCanvas.toDataURL("image/jpeg", 1.0);
                
                App.pageNum--;
                document.getElementById("pdf-current-page").textContent = App.pageNum;
                
                if (App.arrayImageData[App.pageNum - 1].dataImage.length === 0) {
                    await displayPage(App.shownPdf, App.pageNum);
                } else {
                     drawCachedImage(App.arrayImageData[App.pageNum - 1].dataImage);
                     App.DrawingTool.init(); // Updated call
                }
            });
        }

        const uploadButton = document.getElementById("upload-button");
        const fileToUploadInput = document.getElementById("file-to-upload");

        if (uploadButton) {
            uploadButton.addEventListener('click', function () {
                if (fileToUploadInput) fileToUploadInput.click();
            });
        }

        if (fileToUploadInput) {
            fileToUploadInput.addEventListener('change', async function (event) {
                var fileInput = event.currentTarget; 
                if (fileInput.files && fileInput.files[0]) {
                    if (['application/pdf'].indexOf(fileInput.files[0].type) === -1) {
                        console.error('Error: Not a PDF file selected.');
                        fileInput.value = ''; 
                        return;
                    }
                    await showPDF(URL.createObjectURL(fileInput.files[0]));
                }
            });
        }
        
        const cmdButton = document.getElementById("cmd");
        if (cmdButton) {
            cmdButton.addEventListener('click', async function (event) { 
                if (!App.shownPdf || App.__TOTAL_PAGES === 0) {
                    console.error("Please load a PDF first.");
                    return;
                }
                
                const generateButton = event.currentTarget; 
                generateButton.disabled = true;
                generateButton.textContent = 'Processing...';

                if (App.drawCanvas && App.pageNum >=1 && App.pageNum <= App.__TOTAL_PAGES) {
                     App.arrayImageData[App.pageNum - 1].dataImage = App.drawCanvas.toDataURL("image/jpeg", 1.0);
                }

                if (App.canvasWidthOringin === 0 || App.canvasHeightOringin === 0) { 
                    if (App.shownPdf.numPages > 0) {
                        const firstPage = await App.shownPdf.getPage(1); 
                        const viewport = firstPage.getViewport({ scale: App.pdfScale }); 
                        App.canvasHeightOringin = viewport.height * (25.4 / 96); 
                        App.canvasWidthOringin = viewport.width * (25.4 / 96);
                        App.cont = 1; 
                    } else {
                        console.error("Could not determine PDF dimensions for saving.");
                        generateButton.disabled = false;
                        generateButton.textContent = 'Generate PDF';
                        return;
                    }
                }
                
                var pdf = new jsPDF({
                    orientation: App.canvasWidthOringin > App.canvasHeightOringin ? 'l' : 'p', 
                    unit: 'mm',
                    format: [App.canvasWidthOringin, App.canvasHeightOringin]
                });

                const originalPageNum = App.pageNum; 
                const pdfCurrentPageElem = document.getElementById("pdf-current-page");

                for (let i = 1; i <= App.__TOTAL_PAGES; i++) {
                    if(pdfCurrentPageElem) pdfCurrentPageElem.textContent = i + " / " + App.__TOTAL_PAGES; 
                    
                    if (App.arrayImageData[i - 1].dataImage.length === 0) {
                        await displayPage(App.shownPdf, i); 
                        App.arrayImageData[i - 1].dataImage = App.drawCanvas.toDataURL("image/jpeg", 1.0);
                    }
                    
                    const imgData = App.arrayImageData[i - 1].dataImage;
                    if (imgData.length > 0) {
                        if (i > 1) { 
                            pdf.addPage([App.canvasWidthOringin, App.canvasHeightOringin], App.canvasWidthOringin > App.canvasHeightOringin ? 'l' : 'p');
                        }
                        pdf.addImage(imgData, 'JPEG', 0, 0, App.canvasWidthOringin, App.canvasHeightOringin);
                    } else {
                        console.warn("No image data for page " + i + ", skipping in PDF.");
                        if (i > 1) pdf.addPage([App.canvasWidthOringin, App.canvasHeightOringin], App.canvasWidthOringin > App.canvasHeightOringin ? 'l' : 'p');
                        pdf.text("Page " + i + " data missing", 10, 10);
                    }
                }
                
                await displayPage(App.shownPdf, originalPageNum);
                if(App.arrayImageData[originalPageNum-1] && App.arrayImageData[originalPageNum-1].dataImage.length > 0){
                    drawCachedImage(App.arrayImageData[originalPageNum-1].dataImage);
                }

                await pdf.save("download.pdf");
                generateButton.disabled = false;
                generateButton.textContent = 'Generate PDF';
                if(pdfCurrentPageElem) pdfCurrentPageElem.textContent = originalPageNum; 
            });
        }
        // Expose DrawingTool methods to global scope for HTML onclick attributes
        // window.PDFViewerApplication.DrawingTool.color is already available due to object structure
        // window.PDFViewerApplication.DrawingTool.erase is already available
    }); // End of DOMContentLoaded

})(); // End of IIFE
