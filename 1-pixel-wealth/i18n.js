const main_div = document.getElementsByClassName("wealth-wrapper-outer")[0];
const marker_start = "<!--i18n-start-->";
const marker_end = "<!--i18n-end-->";

const translated_images = i18n_data.images || ["cares.svg","ninety.svg","plane.png","poverty.svg"];

fetch("../index.html")
  .then(function(response) {
    if (!response.ok) throw new Error(response.status);
    return response.text();
  })
  .then(function(text) {
    translate_page(text);
    main_div.style.display = 'block';
  })
  .catch(function() {
    main_div.innerHTML = "Error! Please try reloading the page.";
    main_div.style.display = 'block';
  });

function translate_page(response){
    response = response.substring(response.indexOf(marker_start),response.indexOf(marker_end)); //discard metadata
    main_div.innerHTML = response;
    if(window.i18n_data){
        const all = document.querySelectorAll("p,div,h1,h2,h3,span,tspan");
        for (const el of all) {
            for(const cl of el.classList){
                if(cl.startsWith('i18n-')){
                    el.innerHTML = i18n_data.strings[cl] || el.innerHTML; //apply translations
                }
            }
        }

        const imgs = document.getElementsByTagName("IMG");
        for(const img of imgs){
            if(!translated_images.includes(img.src.substring(img.src.lastIndexOf("/")+1))){
                img.src = img.src.replace("/" + i18n_data.code + "/","/"); //set src for untranslated images to english version
            }
        }

        const script = document.createElement("script");
        script.src = "../main.js";
        document.body.appendChild(script);
    } 
}

