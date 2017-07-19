"use strict";

var RowSection, TextSection, ColumnSection, PDFDocument, PDFSection, ImageSection;
//( function() {

    var CurrentStatus = "none";
    
    // A shared static variable
    var PDF = new jsPDF('portrait', 'pt', 'letter');

    var isPDFSection = (section) => {
        if (_.isObject(section) === false) return false;
        var constructors = [ TextSection, RowSection, ImageSection, PDFDocument, ColumnSection, PDFPage, TextMap ];
        return (section.baseClass === PDFSection) || _.some(constructors, con => section.constructor === con);
    };


    /* PDF Section base constructor:
        A common class between the PDFSection classes and the Textwrapper class
    */
    function PDFBase (settings){
        this.initSettings = settings;
        this.baseClass  = PDFBase;  // This is overridden for the PDFSection classes, but not the TextWrapper
    }
    (function() {
        this.initialize = function(globalSettings){
            if (_.has(this, "initSettings")){
                var s = _.defaults(this.initSettings || {}, globalSettings || {});
                var { inheritedSettings={}, TextColor=[0,0,0], FontType="normal", FontSize=10, Font="courier", TextAlign="left" } = s;
                var { DrawColor=[0,0,0], fixedWidth=null, width=null, linePadding={ all: 0 }, overflowAction="split" } = s;
                this.inheritedSettings = inheritedSettings;
                _.forEach({ TextColor, FontType, FontSize, Font, DrawColor, TextAlign }, (val, prop) => {
                    _.set(this, prop, val);
                    _.set(this.inheritedSettings, prop, val);
                });
                if (this.position || s.position) this.position = new Dimensions(this.position || s.position);
                return _.assign(this, { fixedWidth, width: this.width || width, linePadding: new Offset(linePadding), overflowAction });
            }
        };
        this.getStyles = function(){
            var styleNames = ["DrawColor", "Font", "FontSize", "FontType", "LineCap", "LineJoin", "LineWidth", "Properties", "TextColor"];
            return _.reduce(styleNames, (styles, name) => {
                if (_.has(this, name)) {
                    var setStyle = `set${name}`;
                    var style = _.isArray(this[name])? this[name] : [this[name]];
                    return _.set(styles, setStyle, style);
                }
            }, {});
        };
        this.clone  = function(globalSettings){ 
            var img;
            var content = this.cloneContent();
            if (this.constructor === ImageSection && _.isNil(this.image) === false)
                img = this.image.clone();
            var instance = new this.constructor(this);
            if (this.constructor === TextWrapper){
                instance.initialize();
                instance.setContent(this.content);
                return instance;
            }
            if (isPDFSection(this.Header)) instance.Header = this.Header.clone();
            if (isPDFSection(this.Footer)) instance.Footer = this.Footer.clone();
            instance.initSettings = _.isUndefined(this.initSettings)? this : this.initSettings;
            instance.initialize(globalSettings || this.inheritedSettings);
            if (img) instance.image = img;
            instance.content = content;
            return instance;
        };
        this.cloneContent = function(globalSettings){
            return _.map(this.content, c => {
                if (_.isString(c)) return "" + c;
                if (_.isObject(c) && (isPDFSection(c) || c.baseClass === PDFBase))
                    return c.clone();
            });
        };
        this.setStyles = function(styles){
            _.forEach(_.keys(styles), key => PDF[key].apply(PDF, styles[key]));
        };
        this.setWidth = function(width){
            if (_.isFinite(width)) this.width = width;
            else throw "ERROR, width must be a number";
        };
        this.getWidth = funciton(){
            if (this.constructor === ImageSection && _.isNull(this.image) === false)
                return this.image.width;
            else if (this.fixedWidth) 
                return this.fixedWidth;
            else if (this.position && this.position.getWidth() > 0)
                return this.position.getWidth();
            return this.width || 0;
        };

        this.printConstructorName = function(){
            if (this.constructor === PDFBase){
                return "PDFBase";
            } else if ( this.constructor === PDFSection ){
                return "PDFSection";
            } else if ( this.constructor === TextWrapper ){
                return "TextWrapper";
            } else if ( this.constructor === TextSection ){
                return "TextSection";
            } else if ( this.constructor === RowSection ){
                return "RowSection";
            } else if ( this.constructor === ColumnSection ){
                return "ColumnSection";
            } else if ( this.constructor === ImageSection ){
                return "ImageSection";
            } else if ( this.constructor === TextMap ){
                return "TextMap";
            } else if (this.constructor === PDFPage ){
                return "PDFPage";
            } else if ( this.constructor === PDFDocument ){
                return "PDFDocument";
            } else return "UnknownConstructor";
        }

        this.printPath = function( parentPath ){
            parentPath = parentPath || "";
            var pathString = parentPath + this.printConstructorName();
            if (this.constructor === ImageSection){
                if (_.isNull( this.image))
                    return pathString + " -> Image(NULL)\n";
                else if (_.isUndefined(this.image))
                    return pathString + " -> Image(UNDEFINED)\n";
                else if (_.isUndefined(this.image.image) )
                    return pathString + " -> Image.image(UNDEFINED)\n";
                else if (_.isNull(this.image.image))
                    return pathString + " -> Image.image(NULL)\n";
                else if (this.image.image.src){
                    return pathString + " -> Image(" + this.image.image.src + ")\n";
                }
            }
            var size = pathString.length;
            var padding = '\n' +  ' ';
            var elements = this.content;
            if (this.constructor === PDFDocument) elements = this.pages;
            var paths = _.map(elements, (el, index) => {
                var thispadding = (index == 0)? "" : padding;
                if (_.isString(el))    return thispadding + " -> String( " + el + ") \n";
                if (_.isUndefined(el)) return thispadding + " -> Undefined\n";
                if (_.isNull(el))      return thispadding + " -> NULL\n";
                if (isPDFSection(el) || el.constructor === TextWrapper)
                    return el.printPath( thispadding + " -> ");
                return pathString + typeof el + "(" + el  + "\n";
            });
            if (paths.length === 0) return pathString + " -> [] \n";
            else return _.reduce(paths, (str, el) => `${str}${el}`, pathString);
        }
        this.printHeight = function(parentPath, depth){
            parentPath = parentPath || "";
            var sum = 0;
            var max = 0;
            var pathString = parentPath + this.printConstructorName();
            if (this.constructor === ImageSection){
                if (_.isNil(this.image)) return pathString + " -> Image(0)\n";
                else if (this.image.image.src) 
                    return pathString + " -> Image(" + this.image.height + ")\n";
            }
            var size = pathString.length;
            if (this.constructor !== PDFDocument) 
                size += ((`${this.getHeight()}`).length * 2) + 4;
            var padding = parentPath.replace("->", "  ") + "    ";
            var paths = [];
            //paths.push(`||| Padding(${this.padding.verticalSum()})+Margin(${this.margin.verticalSum()})+Position(${this.position || {}).y1})\n`);
            paths.push( "||| Padding(" + this.padding.verticalSum() + ")+Margin("+this.margin.verticalSum() + 
                ")+Position("+(this.position || {}).y1 + ")\n");
            if (this.Header) paths.push(this.Header.printHeight(padding+"::HEADER::"));
            if (this.Footer) paths.push(this.Footer.printHeight(padding+"::FOOTER::"));
            
            var elements = this.content;
            if (this.constructor === PDFDocument) elements = this.pages;
            if (_.isUndefined(depth) || depth > 0){
                _.forEach(elements, (el, index)=>{
                    var childPath = "";
                    if (_.isUndefined(el)) childPath = padding + " -> Undefined(0)\n";
                    else if (_.isNull(el)) childPath = padding + " -> NULL(0)\n";
                    else if (el.constructor === TextWrapper) 
                        childPath = padding + " -> " +  el.printConstructorName()  + " ( " + el.getHeight() + " ) \n";
                    else if (isPDFSection(el)) childPath = el.printHeight( padding + " -> ", (_.isFinite(depth)? depth - 1 : depth ));
                    else childPath = pathString + typeof el + "( ?? ) \n";
                    if (_.isObject(el)){
                        if (el.position) max = Math.max(el.getHeight(), max);
                        else sum += el.getHeight();
                    }
                    paths.push(childPath);
                });
            }

            if (max > sum) sum = max;
            sum += this.padding.verticalSum() + this.margin.verticalSum() + this.getHeaderFooterHeight();
            if (this.position) pathString += "{absPos:" + sum + this.position.y1 + "}"; 
            else pathString += "{" + sum + "}";
            if (this.constructor !== PDFDocument) pathString += "(" + this.getHeight() + ")";
            if (paths.length === 0) return pathString + " -> []( 0 ) \n";
            else return "\n" + pathString + _.reduce(paths, (str, el) => `${str}${el}`, "");
        }
        this.constructor = PDFBase;
    }).call(PDFBase.prototype);

    // PDFSection base constructor
    PDFSection = function (settings) {
        settings = settings || {};
        PDFBase.call(this, settings);
        if (settings.content) this.addContent(settings.content);
    };

    PDFSection.prototype = (function() {
        this.initialize = function(globalSettings){
            var s  = this.initSettings       || {};
            var gs = globalSettings          || {};
            PDFBase.prototype.initialize.call(this, globalSettings);
            if (s.Header || s.header) this.setHeader(s.Header, this.inheritedSettings);
            if (s.Footer || s.footer) this.setFooter(s.Footer, this.inheritedSettings);
            this.content = this.content || s.content || [];
            if (s.FillColor || gs.FillColor) this.FillColor = s.FillColor || gs.FillColor;
            _.assign(this, {
                position        : this.position    || s.positions       || null,
                Border          : this.Border      || s.Border          || gs.Border  
                                                   || s.border          || gs.border || false,
                margin          : new Offset ( this.margin || s.margin  || { all: 0 }),
                overflowAction  : s.overflowAction || gs.overflowAction || "split",
                padding         : new Offset ( this.padding || s.padding || { all: 0 }),
                baseClass   : PDFSection
            });
            if (this.constructor === PDFSection) this.initializeChildren();
            return this;
        };
        this.initializeChildren = function(){
            delete this.initSettings;
            if (this.Header) this.Header.initialize(this.inheritedSettings);
            if (this.Footer) this.Footer.initialize(this.inheritedSettings);
            _.forEach(this.content, c => c.initialize(this.inheritedSettings));
        };
        this.getHeaderHeight = function(){
            return (isPDFSection(this.Header)? this.Header.getHeight() : 0);
        };
        this.getFooterHeight = function(){
            return (isPDFSection(this.Footer)? this.Footer.getHeight() : 0);
        };
        this.getHeaderFooterHeight = function(){
            return this.getHeaderHeight() + this.getFooterHeight();
        };
        this.getHeightWithoutContent = function(){
            var offset = this.margin.clone().add(this.padding);
            return this.getHeaderFooterHeight() + offset.verticalSum();
        };
        this.getBorderStyles = function(){
            var styles = {};
            if( _.has(this), "Border"){
                _.forEach(["DrawColor", "LineCap", "LineJoin", "LineWidth"], (style) => {
                    if (_.has(this, "Border"+style)) {
                        var s = this["Border"+style];
                        _.set(styles, "set"+style, _.isArray(s)? s : [s]);
                    }
                });
            }
            if (_.has(this, "FillColor")) styles.setFillColor = this.FillColor;
            return styles;
        };        

        // Wipe content and add to a PDFSection
        this.setContent =  function ( content ){
            this.content = [];
            return this.addContent(content);
        };
        // Add content to a PDFSection
        this.addContent = function ( content ) {
            this.content = this.content || [];
            var result;
            try { result = this.parseContent(content); }
            catch(e) { console.error(e); result = []; }
            if (_.isArray(result))
                _.forEach(result, c => this.content.push(c));
            else this.content.push(result);
            return this;
        };
        this.parseContent = function(content){
            if (_.isObject(content) && (content.baseClass === PDFBase || content.baseClass === PDFSection)){
                if (_.has(this, "initSettings")){
                    //content.initialize(this.inheritedSettings || this.);
                }
                return content;//.clone();
            }
            else if ( _.isString(content) ||  _.isFinite(content)){
                return new TextSection({}, this.inheritedSettings).addContent(""+content);
            }
            else if (_.isObject (content) && (_.has(content, "type") || _.has(content, "image"))) {
                if (_.has(content, "image")) content.type = "image";
                switch (content.type) {
                    case 'text'     : return new TextSection  (content);
                    case 'row'      : return new RowSection   (content);
                    case 'column'   : // Falls through
                    case 'col'      : return new ColumnSection(content);
                    case 'image'    : return new ImageSection (content);
                }
            }
            else if (_.isArray(content)){
               return _.flatMap(content, el=> {
                    try { return this.parseContent(el); }
                    catch(e) { console.error(e); console.log(content); return aggr; }
               });
            }
            else { throw "Error, content of type " + typeof content + " was not expected."; }
        };

        this.setFooter = function(footer) {
            if (_.isUndefined(footer)) return this;
            this.Footer = this.parseContent(footer);
            return this;
        };

        this.setHeader = function(header) {
            if (_.isUndefined(header)) return this;
            this.Header = this.parseContent(header);
            return this;
        };
        // Check if an object is a PDFSection
    
        this.getHeight = function(){
            var contentHeight = 0;
            var max = 0;
            if (this.constructor === ImageSection && _.isObject(this.image))
                contentHeight = this.image.height;
            _.forEach(this.content, section => {
                if (section.position) max = Math.max(section.getHeight(), max);
                else contentHeight += section.getHeight();
            });
            if (max > contentHeight) contentHeight = max;
            if (this.position) contentHeight += this.position.y1;
            return this.getHeightWithoutContent() + contentHeight;
        };
        
        this.splitContentToWidth = function(availableWidth){}
        this.calcOwnWidth = function(availableWidth){
            if (_.isFinite(availableWidth) !== true)  throw "No width given in calcOwnWidth()";
            return Math.min((this.fixedWidth || availableWidth), availableWidth);
        }
        this.splitToWidth = function(availableWidth){
            if (_.has(this, "initSettings")) throw "Section Not Initilized!";
            availableWidth = this.calcOwnWidth(availableWidth);
            this.setWidth(availableWidth);
            availableWidth -= this.margin.horizontalSum();
            if (isPDFSection(this.Header)) this.Header.splitToWidth( availableWidth );
            if (isPDFSection(this.Footer)) this.Footer.splitToWidth( availableWidth );
            availableWidth -= this.padding.horizontalSum();
            this.splitContentToWidth( availableWidth );
            return this;
        };

        this.splitContentToWidth = function( availableWidth ){
            _.forEach(this.content, el => el.splitToWidth(availableWidth));
        };

        this.splitToHeight = function(availableSpace, nextPageSpace) {
            if (this.constructor === ImageSection && this.getHeight() > availableSpace.getHeight()){
                if (this.getHeight() > nextPageSpace.getHeight()) throw ("Not enough space for image. ");
                else return { status: "newPage", overflow: this };
            }
            var orig = availableSpace.clone();
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            
            var baseHeight = this.getHeightWithoutContent();
            if (this.getHeight() > availableSpace.getHeight()) {
                if (baseHeight > availableSpace.getHeight() || 
                    (baseHeight + ( PDF.internal.getLineHeight() * 3) > availableSpace.getHeight())) {
                    this.splitResult = "noSpace";
                    return { status: "noSpace", overflow: this };
                }
                var search = this;
                while (search.content && search.content.length < 2){
                    if (search.content.length === 0 || _.isString(search.content[0])) {
                        this.splitResult = "noSpace";
                        return { status: "noSpace", overflow: this };
                    }
                    else if (search.content.length === 1)
                        search = search.content[0];
                }
                if (this.overflowAction === "split" || Math.abs(nextPageSpace.getHeight() - availableSpace.getHeight()) < 0.5){
                    var result = { status: (this.overflowAction === "split" ? "split" : "forcedSplit" ) };
                    var usedHeight = this.getHeightWithoutContent();
                    nextPageSpace.offset( { y1: this.getHeightWithoutContent()});
                    availableSpace.offset({ y1: this.getHeightWithoutContent()});
                    var i = 0;  // Max index element that fits
                    var heights = [];
                    var sums = [];
                    var sum = 0;
                    while ( this.content[i].getHeight() + usedHeight < availableSpace.getHeight()){
                        availableSpace.offset( { y1: this.content[ i ].getHeight()});
                        heights[i] = this.content[i].getHeight();
                        sum += heights[i];
                        sums[i] = sum;
                        ++i;
                    }
                    if (i === 0){                         
                        this.splitResult = "noSpace";
                        return { status: "noSpace", overflow: this };
                    }
                    var nestedResult = this.content[i].splitToHeight(availableSpace.clone(), nextPageSpace.clone());
                    if ( nestedResult.status === "newPage" )
                        return { status: "newPage", overflow: this };
                    if ( nestedResult.status === "noSpace" && i === 1 ){
                        return { status: "noSpace", overflow: this };
                    }
                    result.toAdd = this.clone().setContent( _.take(this.content, i));
                    if ( _.has(nestedResult, "toAdd") && !(_.isUndefined(nestedResult.toAdd) ))
                        result.toAdd.addContent( nestedResult.toAdd );
                    
                    result.overflow = this.clone().setContent( [] );
                    if ( _.has( nestedResult, "overflow" ) && !(_.isUndefined(nestedResult.overflow) ))
                          result.overflow.addContent(nestedResult.overflow);
                    result.overflow.addContent(_.drop(this.content, i + 1));


                    var nestedResult = this.content[i].splitToHeight(availableSpace.clone(), nextPageSpace.clone());
                    result.toAdd = this.clone()
                          .setContent( _.take(this.content, i))
                          .addContent( nestedResult.toAdd );
                    result.overflow = this.clone()
                          .setContent( nestedResult.overflow )
                          .addContent( _.drop(this.content, i + 1));
                    if (result.toAdd.getHeight() > orig.getHeight()) throw "Something went wrong in height calculation";
                    return result;
                }
                else {
                    this.splitResult = "newPage";
                    return { status: "newPage", overflow: this };
                }
            }
            else {
                this.splitResult = "normal";
                return { status: "normal", toAdd: this };
            }
        };
    
        this.renderBorderAndFill = function(renderSpace){
            var drawDim   = renderSpace.clone();
            var hasFill   = _.has(this, "FillColor");
            var hasBorder = _.has(this, "Border") && this.Border === true;
            var borderStyles = this.getBorderStyles();
            if (hasFill || hasBorder){
                this.setStyles( borderStyles );
                var x1 = drawDim.x1, 
                    y1 = drawDim.y1, 
                    width = drawDim.getWidth(), 
                    height = drawDim.getHeight();
                if (hasFill && hasBorder) PDF.rect(x1, y1, width, height, "FD");
                else if (hasFill) PDF.rect(x1, y1, width, height, "F");
                else PDF.rect(x1, y1, width, height); // hasBorder
            }
            return this;
        };
    
        this.render = function(renderSpace){ 
            var drawDim = _.isNil(this.position) 
                    ? renderSpace.clone()
                    : renderSpace.clone().translate(this.position.x1, this.position.y1);
            drawDim.setHeight(this.getHeight());
            drawDim.setWidth(this.getWidth());
            drawDim.offset(this.margin);
            var styles  = this.getStyles();
            this.renderBorderAndFill(drawDim);    
            this.setStyles(styles);
            if (isPDFSection(this.Header)){
                this.Header.render( drawDim.clone() );
                drawDim.offset({ y1: this.Header.getHeight() });
            }
            if (isPDFSection(this.Footer)){
                var footerSpace = drawDim.clone().setHeight( this.Footer.getHeight(), true);
                this.Footer.render( footerSpace );
                drawDim.offset( { y2: this.Footer.getHeight() } );
            }
            drawDim.offset( this.padding );
            var contentSpace = drawDim.clone();
            _.forEach(this.content, (section) => {
                var sectionSpace = _.isNil(section.position) ? drawDim.clone() : contentSpace.clone();
                section.render( sectionSpace );
                drawDim.offset( { y1: section.getHeight() });
            });
            this.baseClass = PDFSection;
            return this;
        };
        this.constructor = PDFSection;
        return this;
    }).call(Object.create(PDFBase.prototype));

    // Wraps text for TextSection class ( this was to make the TextSection class more similar to the other PDFSection classes )
    function TextWrapper(settings){
        settings = settings || {};
        this.content = [];
        if (settings.content) this.setContent(settings.content);
        PDFBase.call(this, settings);
    }
    TextWrapper.prototype = (function() {
        this.initialize = function(globalSettings){
            if (_.has(this, "initSettings")){
                PDFBase.prototype.initialize.call(this, globalSettings);            
                delete this.initSettings;
            }
            return this;
        };
        this.setContent = function(content){ 
            return _.set(this, "content", content); 
        };
        this.getHeightWithoutContent = function(){
            var sum = 0;
            sum += Math.max( this.linePadding.top, 0);
            sum += Math.max( this.linePadding.bottom, 0);
            return sum;
        };
        this.getHeight = function(){
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            return this.content.length * PDF.internal.getLineHeight();
        };
        this.splitToWidth = function( availableWidth  ){
            this.setWidth(availableWidth);
            var maxWidth = availableWidth - ( Math.max( this.linePadding.left, 0) + Math.max(this.linePadding.right, 0));
            this.content = PDF.splitTextToSize( this.content, maxWidth, {
                FontSize : this.FontSize,
                FontName : this.Font
            });
            return this;
        };
        this.splitToHeight = function( availableSpace ) {
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            var maxIndex = Math.ceil( availableSpace.getHeight() / PDF.internal.getLineHeight() ) - 1;
            if (maxIndex <= this.content.length) return { status: "normal", toAdd: this }; 
            return { 
                status   : "split",
                toAdd    : this.clone().setContent( _.take( this.content, maxIndex)),
                overflow : this.clone().setContent( _.drop( this.content, maxIndex)) 
            };
        };

        this.getLineWidth = function(text){
            return PDF.getStringUnitWidth(text) * this.FontSize / PDF.internal.scaleFactor;
        }

        this.getXAlign = function( text, availableWidth, actualWidth ) {
            if (actualWidth > availableWidth) throw "Text does not fit to width of container!";
            switch (this.TextAlign){
                case "center" : return (availableWidth - this.getLineWidth(text)) / 2;
                case "right"  : return (availableWidth - this.getLineWidth(text));
                default       : return 0;  // Left align or anything else
            }
        };

        this.render = function(renderSpace){
            var drawDim   = renderSpace.clone(),
            styles        = this.getStyles();
            drawDim.offset({ x1: this.linePadding.left, x2: this.linePadding.right });
            this.setStyles( styles );
            var textStyles = this.getFontStyles();
            this.setStyles( textStyles );
            drawDim.offset({ y1: this.linePadding.top + PDF.internal.getLineHeight()});
            var availableWidth = drawDim.getWidth();
            // Draw each line and update the drawDim
            if ( _.isArray(this.content))  _.forEach(this.content, this.renderAction.bind(this, drawDim, availableWidth));
            // this.content is either string or an unsupported type, which shouldn't happen.  If a string is received, nothing breaks, but it is unexpected.
            else {
                console.log("WARNING: content of type '" + typeof this.content + "'' received in TextWrapper.render().  Array expected.");
                this.renderAction(drawDim, availableWidth, this.content);
            }
        };

        this.renderAction = function(drawDim, availableWidth, line){
            if(_.isString(line)){   // OK
                var x1 = this.getXAlign( line, availableWidth, this.getLineWidth( "" + line) );
                x1 += drawDim.x1;
                PDF.text( x1, drawDim.y1, "" + line );
                drawDim.offset({ y1: Math.max(this.linePadding.top, 0) + PDF.internal.getLineHeight()});
                drawDim.offset({ y2: Math.max(this.linePadding.bottom, 0) });
            }
            // Something went wrong, nothing can be rendered since only string and array types are currently supported
            else console.log("ERROR: Unexpected type received in TextWrapper.renderAction()");
            return this;
        };

        this.getFontStyles = function(){
            return _.reduce(["Font", "FontType", "FontSize", "TextColor"], (styles, style)=>{
                if (_.has(this, style)){
                    var s = _.isArray(this[style])? this[style] : [this[style]];
                    return _.set(styles, "set"+style, s);
                }
                return styles;
            });
        };
        this.baseClass = PDFSection;
        this.constructor = TextWrapper;
        return this;
    }).call(Object.create(PDFBase.prototype));
    
    // Derived PDFSection Type for containing text
    TextSection = function(settings) {
        PDFSection.call(this, settings);
        return this;
    };

    TextSection.prototype = (function() {
        this.initialize = function(globalSettings){
            if ( _.has(this, "initSettings")){
                PDFSection.prototype.initialize.call(this, globalSettings);
                this.padding = new Offset({ all: 3 });
                this.initializeChildren();
            }
            return this;
        };
        this.getHeight = function( ){
            var height = this.getHeightWithoutContent();
            _.forEach(this.content, c => { height += c.getHeight(); });
            if (this.position) height += this.position.y1;
            return height;
        };
        this.addContent = function(content){
            this.content = this.content || [];
            if (_.isNil(content))    content = "";
            if (_.isFinite(content)) content = ""+content;
            if (_.isArray(content) && content.length > 0){
                var allString = true;
                var allTextWrap = true;
                _.forEach(content, line => {
                    if (_.isFinite(line)) line = ""+line;
                    if (_.isNil(line)) line = "";
                    allString = (allString? _.isString(line) : false);
                    allTextWrap = (allTextWrap? _.isObject(line) && line.constructor === TextWrapper : false);
                });
                if (allString || allTextWrap){
                    content = allString
                        ? [new TextWrapper(this.initSettings).setContent(content.join("\n"))]
                        : content;
                }
            }
            else if (_.isString(content) || _.isFinite(content) || _.isObject(content) && content.constructor === TextWrapper){
                content = _.isString(content)
                    ? [new TextWrapper(this.initSettings).setContent(""+content)]
                    : [content];
            }
                
            if (content.length > 0) {
                if (_.has(this, "initSettings") === false)
                    _.forEach(content, el => el.initialize(this.inheritedSettings || {}));
                this.content = this.content.concat(content);
            }
            return this;
        };
        this.constructor = TextSection;
        this.baseClass = PDFSection;

        return this;
    }).call(Object.create(PDFSection.prototype));
    
    // Derived Type RowSection
    RowSection = function(settings) {
        PDFSection.call(this, settings);
        return this;
    };

    RowSection.prototype = (function() {
        this.initialize = function(globalSettings){
            if (_.has(this, "initSettings")){
                PDFSection.prototype.initialize.call(this, globalSettings);
                this.initializeChildren();
            }
            return this;
        };
        this.getHeight = function( ){
            var height = 0;
            _.forEach (this.content, col => { height = Math.max(col.getHeight(), height); });
            return height + this.getHeightWithoutContent();
        };
    
        this.splitContentToWidth = function(availableWidth){
            _.forEach(this.content, (col, i) => {
                var col = this.content[i];
                var thisWidth = availableWidth / (this.content.length - i);
                thisWidth = col.fixedWidth? Math.min(thisWidth, col.fixedWidth) : thisWidth;
                col.splitToWidth(thisWidth);
                availableWidth -= thisWidth;
            });
            return this;
        };
    
        this.splitToHeight = function(availableSpace, nextPageSpace) {
            var orig = availableSpace.clone();
            if (this.getHeight() > availableSpace.getHeight()) {
                if (this.overflowAction === "split" || Math.abs(nextPageSpace.getHeight() - availableSpace.getHeight()) < 0.5){
                    var result = { 
                        status   : (this.overflowAction === "split" ? "split" : "forcedSplit" ),
                        toAdd    : this.clone().setContent([]),
                        overflow : this.clone().setContent([])
                    };
                    availableSpace.offset( { y1: this.getHeightWithoutContent()} );
                    nextPageSpace.offset(  { y1: this.getHeightWithoutContent()} );
                    for( var i = 0; i < this.content.length; ++i ){
                        var nestedResult = this.content[i].splitToHeight( availableSpace.clone(), nextPageSpace.clone() );
                        if (nestedResult.status === "newPage") return { status: "newPage", overflow: this };
                        result.toAdd.addContent(nestedResult.toAdd);
                        var overflow = nestedResult.overflow || nestedResult.toAdd;
                        if (nestedResult.status === "normal"){
                            var lastEl = overflow;
                            while(isPDFSection(lastEl) && lastEl.content.length > 0 && isPDFSection(_.last(lastEl.content))){
                                lastEl.content = _.takeRight(lastEl.content, 1);
                                lastEl = lastEl.content[0];
                            }
                        }
                        result.overflow.addContent( overflow ); 
                    }
                    if (result.toAdd.getHeight() > orig.getHeight())
                        console.error("Error calculating height");
                    return result;
                }
                else return { status: "newPage", overflow: this };
            }
            return { status: "normal", toAdd: this.clone() };
        };
    
        this.render = function(renderSpace){
            var [drawDim, styles] = [renderSpace.clone().offset(this.margin), this.getStyles()];
            this.renderBorderAndFill(drawDim);
            drawDim.offset( this.padding );
            this.setStyles(styles);
            if (isPDFSection(this.Header)){
                var headerSpace = drawDim.clone().setHeight( this.Header.getHeight());
                this.Header.render(headerSpace);
                drawDim.offset( { y1: this.Header.getHeight() } );
            }
            if (isPDFSection(this.Footer)){
                var footerSpace = drawDim.clone().setHeight( this.Footer.getHeight());
                this.Footer.render( footerSpace );
                drawDim.offset( { y2: this.Footer.getHeight() } );
            }
            _.forEach(this.content, (section) => {
                var sectionSpace = drawDim.clone().setWidth(section.getWidth());
                section.render( sectionSpace );
                drawDim.offset( { x1: section.getWidth() });
            });
            return this;
        };
        this.constructor = RowSection;
        return this;
    }).call(Object.create(PDFSection.prototype));

    // Derived Type ColumnSection
    ColumnSection = function(settings) {
        PDFSection.call(this, settings);
        return this;
    };
    ColumnSection.prototype = (function(){
        this.initialize = function(globalSettings){
            if (_.has(this, "initSettings")){
                PDFSection.prototype.initialize.call(this, globalSettings);
                this.initializeChildren();
            }
            return this;
        };
        this.constructor = ColumnSection;
        return this;
    }).call(Object.create(PDFSection.prototype));

    ImageSection = function(settings){     
        PDFSection.call(this, settings);
       return this;
    };

    ImageSection.prototype = (function(){
        this.initialize = function(globalSettings){
            if (_.has(this, "initSettings")){
                var s  = this.initSettings || {};
                var gs = globalSettings || {};
                PDFSection.prototype.initialize.call(this, gs);
                _.assign(this, {
                    image   : s.image || gs.image || null,
                    position  : new Dimensions(s.position || {x1: 0, y1: 0, width: 0, height: 0}),
                    angle     : s.angle || 0
                });
                this.initializeChildren();
            }
            return this;
        };
        this.render = function(renderSpace){
            var drawSpace = _.isUndefined(this.position) || _.isNull(this.position)
                ? renderSpace.clone()
                : renderSpace.clone().translate(this.position.x1, this.position.y1);
            drawSpace.offset(this.padding.add(this.margin));
            var uri = this.image.getURI();
            var format = uri.substring(12,15)==="png" ? "png" : "jpg";
            PDF.addImage(this.image.getURI(), format, drawSpace.x1, drawSpace.y1, this.image.width, this.image.height);
            //PDFSection.prototype.render.call(this, renderSpace.clone().offset(this.padding.add(this.margin)));
            return this;
        };
        this.constructor = ImageSection;
        return this;
    }).call(Object.create(PDFSection.prototype));

    //TextMap, for conveniently placing text over a(n) background image(s) or nothing at all
    function TextMap(settings){
        PDFSection.call(this, settings);
        return this;
    }

    TextMap.prototype = (function(){
        this.initialize = function(globalSettings){
             if (_.has(this, "initSettings")){
                PDFSection.prototype.initialize.call(this, globalSettings);
                this.initializeChildren();
            }
            return this;
        };
        // Add text at position
        this.add = function(content, x, y, w){
            if (_.isArray(x) && x.length === 2){
                [w, y, x] = [y, x[1], x[0]];
            }
            this.addContent({
                type: "text", 
                content: content, 
                position: new Dimensions({ x1: x, y1: y, width: w}),
                Border: false
            });
            return this;
        };

        // Add an image at the given position
        this.addImage = function(imageData, x, y, w, h, angle){
            if ( _.isArray(x) && x.length === 2) 
                [angle, h, y, x] = [h, w, x[1], x[0]];
            var img = new ImageSection({
                image: imageData,
                position: new Dimensions({ x1: x, y1: y, width: w, height: h }), 
                angle: angle,
                Border: false
            });
            img.constructor = ImageSection;
            this.addContent(img);
            return this;
        };
        return this;
    }).call(Object.create(PDFSection.prototype));
    TextMap.prototype.constructor = TextMap;

    // Derived Type PDFPage
    function PDFPage(settings) {
        PDFSection.call(this, settings);
        this.initialize(this);
        _.assign(this, {
            documentSpace: settings.documentSpace.clone(),
            pageSpace    : settings.pageSpace.clone(),
            contentSpace : settings.contentSpace.clone(),
            pageFormat   : settings.pageFormat
        });
        return this;
    }
    PDFPage.prototype = Object.create(PDFSection.prototype);
    PDFPage.prototype.initialize = function(){
        PDFSection.prototype.initialize.call(this);
        delete this.initSettings;
    }
    PDFPage.prototype.constructor = PDFPage;

    // Derived Type PDFDocument
    PDFDocument = function ( settings ) {
        PDFSection.call( this, settings );  
        $(document).off("InitializationComplete");
        $(document).off("PageSplitComplete");
        $(document).off("Initialized");
        $(document).on({
            "InitializationComplete": this.render.bind(this),
            "PageSplitComplete": ()=>{
                CurrentStatus = "Initialized";
                $(document).trigger("InitializationComplete");
            }
        }); 
        return this;
    };
    PDFDocument.prototype = (function() {
        this.addPage = function(){
            if (this.currentPage !== null)
                this.pages.push( this.currentPage.clone().setHeader(this.Header).setFooter(this.Footer) );
            this.currentPage = new PDFPage(this)
            .setHeader(this.Header)
            .setFooter(this.Footer)
            .setContent([]);
            return this.currentPage;
        };
        this.render = function(){
            if (CurrentStatus === "Initialized"){
                PDF = new jsPDF('portrait', 'pt', 'letter');
                var renderOne = function( page, index ){
                    page.render(page.documentSpace.clone());
                    if ((index + 1) < this.pages.length){
                        PDF.addPage();
                        setTimeout( renderOne.bind( this, this.pages[index + 1], index + 1 ));
                    }
                    else $(document).trigger("RenderComplete");
                }
                if (this.pages.length > 0) renderOne.call(this, this.pages[0], 0);
            }
            else if(CurrentStatus !== "Initializing") this.initialize();
            return this;
        };
        this.save = function(fileName){
            fileName = fileName || "document.pdf";
            PDF.save(fileName);
        };
        this.uri = function(){
            return PDF.output("datauristring");
        };
        this.newWindow = function(){
            PDF.output("datauri");
        };    
        this.initialize = function() {
            CurrentStatus = "initializing";
            PDFSection.prototype.initialize.call(this);
            var s = this.initSettings || {};
            _.assign(this, {
                currentPage   : null,
                pages         : [],
                documentSpace : new Dimensions( s.documentSpace || { width : 612, height : 792 }),
                pageFormat    : s.pageFormat || "portrait",
                PDFName       : s.PDFName || "PDF"
            });
            this.pageSpace = this.documentSpace.clone().offset( this.margin );
            var width = this.pageSpace.getWidth() - this.padding.horizontalSum();
            this.initializeChildren( width );
            if (this.Header) this.Header.splitToWidth(this.pageSpace.getWidth());
            if (this.Footer) this.Footer.splitToWidth(this.pageSpace.getWidth());
            this.contentSpace = this.pageSpace.clone().offset({ top: this.getHeaderHeight(), bottom: this.getFooterHeight() });
            this.addPage();
            this.SplitToPages( width );
            return this;
        };

        this.SplitToPages = function(width){
            var splitOne = (section, index) => {
                if (section.initSettings) throw "Section is not initialized!";
                section.splitToWidth(width);
                var page = this.currentPage;
                var result = section.splitToHeight(page.contentSpace.clone(), page.pageSpace.clone());
                if (result.status !== "newPage" && result.toAdd && result.toAdd.getHeight() > page.contentSpace.getHeight())
                    throw "Over page bounds";
                while (result.status !== "normal") {
                    if (result.status === "split" || result.status === "forcedSplit"){
                        page.addContent(result.toAdd);
                        page.contentSpace.offset({ y1: result.toAdd.getHeight() });
                    }
                    if (result === "noSpace") throw "No Space on current page!";
                    // Executes for both "split" and "newPage" results
                    page = this.addPage();
                    result = result.overflow.splitToHeight( page.contentSpace, page.pageSpace );
                }
                if ( result.status === "normal"){
                    this.currentPage.addContent( result.toAdd );
                    page.contentSpace.offset({ y1: result.toAdd.getHeight() });
                }
                if ((index + 1) < this.content.length)
                    setTimeout(splitOne.bind(this, this.content[index + 1], index + 1 ));
                else if( this.currentPage.content.length > 0){
                    this.addPage();
                    $(document).trigger("PageSplitComplete");
                }
            };
            if (this.content.length > 0) splitOne.call( this, this.content[0], 0 );
        };
        this.constructor = PDFDocument;
        return this;
    }).call(Object.create(PDFSection.prototype));
//}());

function Offset(_offset, _right, _bottom, _left) {
    this.set = (offset, right, bottom, left) => {
        if (_.isObject(offset)) {
            if (_.has(offset, "all")) return this.set(offset.all, offset.all, offset.all, offset.all);
            this.top    = offset.top    || this.top     || 0;
            this.right  = offset.right  || this.right   || 0;
            this.bottom = offset.bottom || this.bottom  || 0;
            this.left   = offset.left   || this.left    || 0;
        }
        else {
            this.top    = offset || this.top     || 0;
            this.right  = right  || this.right   || 0;
            this.bottom = bottom || this.bottom  || 0;
            this.left   = left   || this.left    || 0;
        }
        return this;
    };

    this.set(_offset, _right, _bottom, _left);
    
    this.clone = () =>{ 
        return new Offset(this); 
    };

    this.add = (offset, right, bottom, left) => {
        if (_.isObject(offset)) {
            this.top    += ( offset.top    || 0 );
            this.right  += ( offset.right  || 0 );
            this.bottom += ( offset.bottom || 0 );
            this.left   += ( offset.left   || 0 );
        }
        else {
            this.top    += ( offset || 0 );
            this.right  += ( right  || 0 );
            this.bottom += ( bottom || 0 );
            this.left   += ( left   || 0 );
        }
        return this;
    };

    this.negate = (flags, negRight, negbottom, negleft) => {
        if (_.isUndefined(flags)) flags = { top:true, bottom:true, left:true, right:true };
        if (_.isObject(flags)) {
            this.top    = flags.top    ? (0 - this.top)    : this.top;
            this.right  = flags.right  ? (0 - this.right)  : this.right;
            this.bottom = flags.bottom ? (0 - this.bottom) : this.bottom;
            this.left   = flags.left   ? (0 - this.left)   : this.left;
        }
        else {
            this.top    = flags        ? (0 - this.top)    : this.top;
            this.right  = negRight     ? (0 - this.right)  : this.right;
            this.bottom = negbottom    ? (0 - this.bottom) : this.bottom;
            this.left   = negleft      ? (0 - this.left)   : this.left;
        }
        return this;
    };

    this.verticalSum   = () => { return this.top + this.bottom; };
    this.horizontalSum = () => { return this.left + this.right; };
}

function Coordinate(x0, y0){
    this.x = 0;
    this.y = 0;
    this.add(x0, y0);
}

Coordinate.prototype = (function(){
    this.add = function(x0, y0){
        if ( _.isObject(x0) && _.has( x0, "x") || _.has( x0, "y")){
            this.x += x0.x || 0;
            this.y += x0.y || 0;
        }
        else {
            this.x += x0 || 0;
            this.y += y0 || 0;
        }
    }
    this.negate = function(){
        this.x = 0 - this.x;
        this.y = 0 - this.y;
    }
    this.clone = function(){
        return new Coordinate( this.x, this.y );
    }
}).call(Object.create(Object));

function Dimensions( _dim, _x2, _y1, _y2 ) {
    this.set = function(dim, x2, y1, y2 ) {
        if ( _.isObject( dim ) ) {
            this.x1 = dim.x1 || 0;  
            this.y1 = dim.y1 || 0;
            this.x2 = dim.x2 || ( this.x1 + ( dim.width  || 0 ) );
            this.y2 = dim.y2 || ( this.y1 + ( dim.height || 0 ) );
        }
        else {
            this.x1 = dim || 0;
            this.x2 = x2  || this.x1;
            this.y1 = y1  || 0;
            this.y2 = y2  || this.y1;
        }
        return this;
    }.bind(this);

    this.set(_dim, _x2, _y1, _y2);

    this.clone = function(){
        return new Dimensions( this.x1, this.x2, this.y1, this.y2 );
    };

    this.setWidth = function( width, adjustLeftCoordinate ) {
        if ( _.isFinite( width ) ) { 
            if ( adjustLeftCoordinate === true ) { this.x1 = this.x2 - width; }
            else { this.x2 = this.x1 + width; }
            return this;
        }
        else {
            throw "ERROR: Width must be a number!";
        }
    }.bind(this);

    this.getWidth = function(){
        return this.x2 - this.x1;
    }.bind( this );

    this.setHeight = function( height, adjustTopCoordinate ) {
        if ( _.isFinite( height ) ) { 
            if ( adjustTopCoordinate === true ) { this.y1 = this.y2 - height; }
            else { this.y2 = this.y1 + height; }
            return this;
        }
        else {
            throw "ERROR: Height must be a number";
        }
    }.bind(this);

    this.getHeight = function(){
        return this.y2 - this.y1;
    }.bind( this );

    this.offset = function( _dim, x2, y1, y2 ) {

        if ( _.isFinite(_dim) && _.isUndefined(x2) 
            && _.isUndefined(y1) && _.isUndefined(y2)){
            console.log ( "WARNING: Only a single number was supplied as an offset.  Are you sure you didn't mean to pass an object?");
        }

        // bottom/y2 and right/X2 are assumed to be an offset inward, kind of like css uses right and bottom
        if ( _.isObject( _dim ) ) {
            this.x1 += ( _dim.x1 || _dim.left   || 0 );
            this.x2 -= ( _dim.x2 || _dim.right  || 0 );
            this.y1 += ( _dim.y1 || _dim.top    || 0 );
            this.y2 -= ( _dim.y2 || _dim.bottom || 0 );
        }
        else {
            this.x1 = this.x1 + _dim || 0;
            this.x2 = this.x2 - x2   || 0;
            this.y1 = this.y1 + y1   || 0;
            this.y2 = this.y2 - y2   || 0;
        }
        return this;
    }.bind( this );
    this.translate = function( x, y ){
        if ( _.isObject(x) ){
            y = x.y || 0;
            x = x.x || 0;
        }
        this.x1 += x;
        this.x2 += x;
        this.y1 += y;
        this.y2 += y;
        return this;
    }.bind(this);
}

function ImageData(image, width, height) {
    this.width = width;
    this.height = height;
    this.setDimensions = function(width, height) {
        this.width = width  || this.image.naturalWidth;
        if (width && !height){
            var scale = width / this.image.naturalWidth;
            this.height = this.image.naturalHeight * scale;
        }
        else {
            this.height = height || this.image.naturalHeight;
        }
    }.bind(this);
    
    this.getURI = function(format, quality){
        var width   = this.image.naturalWidth;
        var height  = this.image.naturalHeight;
        var canvas  = document.createElement('canvas');
        var context = canvas.getContext('2d');
        if ( format !== "png" && format !== "jpeg")
            format = "png";
        format = "image/" + (format || "png");

        canvas.width  = width;
        canvas.height = height;
        context.drawImage(this.image, 0, 0, width, height);
        return canvas.toDataURL(format, quality);
    }.bind(this);

    this.clone = function(){
        var instance = new ImageData(this.image, this.width, this.height);
        return instance;
    }.bind(this);

    if ( _.isString( image ) ) {
        this.image     = new Image();
        this.image.src = image;
        this.image.onload = function(){
            this.setDimensions(width, height);
        }.bind(this);
    }
    else if ( _.isObject(image) && ( image.constructor === Image || image.constructor === HTMLImageElement )  ){
        this.image = image.cloneNode(true);
        this.setDimensions(width, height);
    }

    return this;
}


function PDFStyle( s ){
    this.TextColor = s.TextColor || [0, 0, 0];
    this.width     = s.width     || "auto";
    this.position = new Dimensions( s.position  || {all: 0});
    // fixedWidth  :             s.fixedWidth    || null,
    // width       :             this.width      || s.width         || null,
    // Font        :             s.Font          || gs.Font         || 'courier',
    // FontSize    :             s.FontSize      || gs.FontSize     || 10,
    // DrawColor   :             s.DrawColor     || gs.DrawColor    || [0, 0, 0],
    // linePadding : new Offset (s.linePadding   || gs.linePadding  || { all: 0 } ),
    // overflowAction : "split", 
        
}

function PDFStyleSheet( styles ){
    this.styles = {}
    this.add(styles);
}

PDFStyleSheet.prototype = (function(){
    this.add = function( name, styles ){
        if ( _.isArray( name ) ){
            _.forEach(name, this.add.bind(this));
        }
        else if ( _.isObject( name ) ){
            _.forOwn( name, function(val, key){
                this.add(key, val);
            }.bind(this))
        }
        else if ( _.isString(name) !== true || _.isObject(style) !== true ){
            throw "Error in style declaration";
        }
        else if ( styles.constructor !== PDFStyle ) {
            styles = new PDFStyle(styles);
        }
        else this.styles[ name ] = new PDFStyle(styles);
    }
    return this;
}).call(Object.create(Object));
