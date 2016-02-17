"use strict";

var RowSection, TextSection, ColumnSection, PDFDocument, PDFSection;
//( function() {

    // A shared static variable
    var PDF = new jsPDF('portrait', 'pt', 'letter');

    // Convenience function to set properties in constructor
    function setProperties ( mappedVals ) {
        _.forEach ( _.keys( mappedVals ), function ( prop ) {
            this [ prop ] = mappedVals [ prop ];
        }.bind(this));
        return this;
    }
    
    

    /* PDF Section base constructor:
        A common class between the PDFSection classes and the Textwrapper class
    */
     function PDFBase (settings, globalSettings ){
        var s  = settings       || {};
        var gs = globalSettings || {};
        return setProperties.call(this, {
            inheritedSettings :       s.inheritedSettings || gs.inheritedSettings || {},
            fixedWidth  :             s.fixedWidth   || null,
            width       :             s.width        || null,
            Font        :             s.Font         || gs.Font         || 'courier',
            FontSize    :             s.FontSize     || gs.FontSize     || 10,
            DrawColor   :             s.DrawColor    || gs.DrawColor    || [100, 100, 240],
            linePadding : new Offset (s.linePadding  || gs.linePadding  || { all: 0 } ),
            overflowAction : "split",
            constructor : PDFBase,
            baseClass   : PDFBase  // This is overridden for the PDFSection classes, but not the TextWrapper
        });
    }
    (function() {
        this.getStyles = function(){
            var styles = {};
            _.forEach(["DrawColor", "FillColor", "Font", "FontSize", "FontStyle",
                       "LineCap", "LineJoin", "LineWidth", "Properties", "TextColor"], 
                       function(style){
                         if( _.has(this, style) ){
                            styles["set"+style] = this[style];
                            if( !_.isArray(styles["set"+style])){
                                styles["set"+style] = [styles["set"+style]];
                            }
                         }
                       }.bind(this));
            return styles;
        };
        this.clone  = function(globalSettings){ 
            var instance = new this.constructor(this, globalSettings || this.inheritedSettings).setContent(this.content);
            if ( this.constructor === TextWrapper)
                return instance;
            if ( this.isPDFSection( this.Header) )
                instance.setHeader(this.Header);
            if ( this.isPDFSection( this.Footer) )
                instance.setFooter(this.Footer);
            return instance;
        };
        this.setStyles = function(styles){
            _.forEach(_.keys(styles), function(key){
                PDF[key].apply(PDF, styles[key] );
            });
        };
        this.setWidth = function(width){
            if ( _.isNumber(width)){
                this.width = width;
            }
            else{
                throw "ERROR, width must be a number";
            }
        };
        this.getWidth = function(){
            return this.width;
        };
    }).call(PDFBase.prototype);


    // PDFSection base constructor
    PDFSection = function ( settings, globalSettings ) {
        var s  = settings       || {};
        var gs = globalSettings || {};
        PDFBase.call(this, s, gs);

        if ( s.Header || s.header )
            this.setHeader( s.Header, this.inheritedSettings);
        if ( s.Footer || s.footer )
            this.setFooter(s.Footer, this.inheritedSettings);

        this.setContent(s.content || []);
        
        return setProperties.call(this, {
            Border          : s.Border         || gs.Border         || true,
            //FillColor       : s.FillColor      || gs.FillColor      || [100, 100, 240],
            margin          : new Offset ( s.margin  || { all: 0 }),
            overflowAction  : s.overflowAction || gs.overflowAction || "split",
            padding         : new Offset ( s.padding || { all: 0 }),
            constructor : PDFSection,
            baseClass   : PDFSection
        });
    };

    PDFSection.prototype = (function() {
        this.getHeaderHeight = function(){
            return ( this.isPDFSection(this.Header)? this.Header.getHeight() : 0 );
        };
        this.getFooterHeight = function(){
            return ( this.isPDFSection(this.Footer)? this.Footer.getHeight() : 0 );
        };
        this.getHeaderFooterHeight = function(){
            return this.getHeaderHeight() + this.getFooterHeight();
        };
        this.getHeightWithoutContent = function(){
            var offset = this.margin.clone().add( this.padding );
            return this.getHeaderFooterHeight() + offset.verticalSum();
        };
        this.getBorderStyles = function(){
            if( _.has(this), "Border"){
                var styles = {};
                _.forEach(["DrawColor", "LineCap", "LineJoin", "LineWidth"], 
                           function(style){
                             if( _.has(this, "Border"+style) ){
                                styles["set"+style] = this["Border"+style];
                                if( !_.isArray(styles["set"+style])){
                                    styles["set"+style] = [styles["set"+style]];
                                }
                             }
                           }.bind(this));
                if( _.has(this, "FillColor")){
                    styles.setFillColor = this.FillColor;
                }
                return styles;
            }
            else return {};
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
            if ( _.isArray(result))
                _.forEach(result, function(c){  this.content.push(c);  }.bind(this));
            else 
                this.content.push(result);
            return this;
        };
        this.parseContent = function(content){
            if ( _.isObject( content ) && ( this.isPDFSection(content) || (this.constructor === TextSection && content.constructor === TextWrapper)))    
                return content.clone(this.inheritedSettings);
            else if ( _.isString( content ))
                return new TextSection({}, this.inheritedSettings).addContent(content);
            else if ( _.isObject ( content ) && _.has(content, "type")) {
                switch ( content.type )  {
                    case 'text'     : return new TextSection  (content, this.inheritedSettings);
                    case 'row'      : return new RowSection   (content, this.inheritedSettings);
                    case 'column'   : // Falls through
                    case 'col'      : return new ColumnSection(content, this.inheritedSettings);
                }
            }
            else if ( _.isArray ( content ) ){
               return _.reduce( content, function(aggr, el){
                    try {
                        var result = this.parseContent(el);
                        return aggr.concat(result);
                    }
                    catch(e) { console.error(e); console.log(content); return aggr; }
               }.bind(this), []);
            }
            else { throw "Error, content of type " + typeof content + " was not expected."; }
        };
        this.setFooter = function(footer) {
            this.Footer = this.parseContent(footer);
            return this;
        };
        this.setHeader = function(header) {
            this.Header = this.parseContent(header);
            return this;
        };
        // Check if an object is a PDFSection
        this.isPDFSection = function ( section ) {
            return _.isObject( section ) && section.baseClass === PDFSection;
        };
    
        this.getHeight = function(){
            var height = 0 + this.getHeightWithoutContent();
            _.forEach( this.content, function(section) {
                height += section.getHeight();
            }.bind(this));
            return height;
        };
    
        this.splitToWidth = function( availableWidth ){
            if ( _.isNumber( this.fixedWidth ) ){
                availableWidth = Math.min( this.fixedWidth, availableWidth );
            }
            if ( !( _.isNumber(availableWidth) )){
                throw "ERROR, no width given";
            }
            this.setWidth(availableWidth);
            var offset = this.margin.clone().add( this.padding );
            var maxWidth = availableWidth - offset.horizontalSum();
            for ( var i = 0; i < this.content.length; i++){
                this.content[i].splitToWidth(maxWidth);
            }
            return this;
        };

        this.splitToHeight = function( availableSpace, nextPageSpace ) {
            var orig = availableSpace.clone();
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            
            var baseHeight = this.getHeightWithoutContent();
            if ( this.getHeight() > availableSpace.getHeight() ) {
                if ( baseHeight > availableSpace.getHeight() || 
                    (baseHeight + ( PDF.internal.getLineHeight() * 3) > availableSpace.getHeight())) {
                    return { status: "newPage", overflow: this };
                }
                var search = this;
                while( search.content && search.content.length < 2){
                    if( search.content.length === 0 || _.isString(search.content[0])){
                        return  { status: "newPage", overflow: this };
                    }
                    else if( search.content.length === 1 ){
                        search = search.content[0];
                    }
                }
                if ( this.overflowAction === "split" || Math.abs(nextPageSpace.getHeight() - availableSpace.getHeight()) < 0.5){
                    var result = { status: (this.overflowAction === "split" ? "split" : "forcedSplit" ) };
                    var usedHeight = this.getHeightWithoutContent();
                    nextPageSpace.offset( { y1: this.getHeightWithoutContent()});
                    var i = 0; 
                    while ( this.content[i].getHeight() + usedHeight < availableSpace.getHeight()){
                        availableSpace.offset( { y1: this.content[ i ].getHeight()});
                        ++i;
                    }
                    if ( i === 0 ){ 
                        return { status: "newPage", overflow: this };
                    }
                    var nestedResult = this.content[i].splitToHeight(availableSpace.clone(), nextPageSpace.clone());
    
                    result.toAdd = this.clone()
                          .setContent( _.take(this.content, i))
                          .addContent( nestedResult.toAdd );
    
                    result.overflow = this.clone()
                          .setContent( nestedResult.overflow )
                          .addContent( _.drop(this.content, i + 1));
                    if ( result.toAdd.getHeight() > orig.getHeight()){
                        throw "";
                    }
                    return result;
                }
                else return { status: "newPage", overflow: this };
            }
            else return { status: "normal", toAdd: this };
        };
    
        this.renderBorderAndFill = function(renderSpace){
            var drawDim   = renderSpace.clone();
            var hasFill   = _.has(this, "FillColor");
            var hasBorder = _.has(this, "Border");
            var borderStyles = this.getBorderStyles();
            if ( hasFill || hasBorder ){
                this.setStyles( borderStyles );
                var x1 = drawDim.x1, 
                    y1 = drawDim.y1, 
                    width = drawDim.getWidth(), 
                    height = drawDim.getHeight();
                if ( hasFill && hasBorder )
                    PDF.rect( x1, y1, width, height, "FD");
                else if ( hasFill )
                    PDF.rect( x1, y1, width, height, "F");
                else  // hasBorder
                    PDF.rect( x1, y1, width, height );
            }
            return this;
        };
    
        this.render = function(renderSpace){
            var drawDim = renderSpace.clone().offset(this.margin),
                styles  = this.getStyles();
            this.renderBorderAndFill(drawDim);    
            drawDim.offset( this.padding );
            this.setStyles( styles );
    
            if ( this.isPDFSection( this.Header ) ){
                var headerSpace = drawDim.clone().setHeight( this.Header.getHeight());
                this.Header.render( headerSpace );
                drawDim.offset( { y1: this.Header.getHeight() } );
            }
            if ( this.isPDFSection( this.Footer ) ){
                var footerSpace = drawDim.clone().setHeight( this.Footer.getHeight(), true);
                this.Footer.render( footerSpace );
                drawDim.offset( { y2: this.Footer.getHeight() } );
            }


            _.forEach(this.content, function(section){
                var sectionSpace = drawDim.clone().setHeight( section.getHeight());
                section.render( sectionSpace );
                drawDim.offset( { y1: section.getHeight() });
            }.bind(this));
            return this;
        };

        return this;
    }).call( Object.create( PDFBase.prototype ) );


    // Wraps text for TextSection class ( this was to make the TextSection class more similar to the other PDFSection classes )
    function TextWrapper(settings, globalSettings){
        PDFBase.call(this, settings, globalSettings);
        settings = settings || {};
        return setProperties.call(this, {
            content     : settings.content || [],
            constructor : TextWrapper
        });
    }

    
    TextWrapper.prototype = (function() {
        this.setContent = function(content){
            this.content = content;
            return this;
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
            if ( maxIndex <= this.content.length ) { 
                return { status: "normal", toAdd: this }; 
            }
            return { 
                status   : "split",
                toAdd    : this.clone().setContent( _.take( this.content, maxIndex)),
                overflow : this.clone().setContent( _.drop( this.content, maxIndex)) 
            };
        };
        this.render = function(renderSpace){
            var drawDim   = renderSpace.clone(),
            styles        = this.getStyles();       
            drawDim.offset({ x1: this.linePadding.left, x2: this.linePadding.right });
            this.setStyles( styles );
            drawDim.offset({ y1: this.linePadding.top + PDF.internal.getLineHeight()});
            if ( _.isArray(this.content)){
                _.forEach(this.content, function(line){
                    PDF.text(drawDim.x1, drawDim.y1, line);
                    drawDim.offset({ y1: Math.max(this.linePadding.top, 0) + PDF.internal.getLineHeight()});
                    drawDim.offset({ y2: Math.max(this.linePadding.bottom, 0) });
                }.bind(this));
            }
            else if(_.isString(this.content)){
                console.log("WARNING: expected array in content, received type: string");
                PDF.text(drawDim.x1, drawDim.y1, this.content);
            }
            else {
                console.error("Error: expected array in content, received type: " + typeof this.content );
            }
            return this;
        };
        return this;
    }).call( Object.create( PDFBase.prototype ) );


    
    // Derived PDFSection Type for containing text
    TextSection = function( settings, globalSettings ) {
        PDFSection.call( this, settings, globalSettings );
        this.constructor = TextSection;
        return this;
    };

    TextSection.prototype = (function() {
        this.getHeight = function( ){
            var height = this.getHeightWithoutContent();
            _.forEach ( this.content, function(c) {
                height += c.getHeight();
            }.bind(this));
            return height;
        };
        this.addContent = function(content){
            if ( _.isArray( content ) && content.length > 0 ){
                var allString = true;
                var allTextWrap = true;
                _.forEach( content, function(line){
                    allString = ( allString? _.isString( line ) : false );
                    allTextWrap = (allTextWrap? _.isObject(line) && line.constructor === TextWrapper : false);
                });
                if ( allString )
                    this.content.push(new TextWrapper(this, this.inheritedSettings).setContent(content.join("\n")));
                else if ( allTextWrap)
                    this.content = this.content.concat(content);
            }
            else if ( _.isString( content )){
                this.content.push(new TextWrapper(this, this.inheritedSettings).setContent(content));
            }
            else if ( _.isObject(content) && content.constructor === TextWrapper)
                this.content.push(content);
            return this;
        };
        return this;
    }).call( Object.create( PDFSection.prototype ));
    

    // Derived Type RowSection
    RowSection = function( settings ) {
        settings = settings || {};
        settings.padding = settings.padding || new Offset({ all: 0 });
        PDFSection.call ( this, settings );
        this.constructor = RowSection;
        return this;
    };

    RowSection.prototype = (function() {
        this.getHeight = function( ){
            var height = 0;
            _.forEach ( this.content, function(col) {
                height = Math.max( col.getHeight(), height);
            }.bind(this));
            return height + this.getHeightWithoutContent();
        };

    
        this.splitToWidth = function(availableWidth){
            if ( _.isNumber( this.fixedWidth ) ){
                availableWidth = Math.min( this.fixedWidth, availableWidth );
            }
            if ( !( _.isNumber(availableWidth) )){
                throw "ERROR, no width given";
            }
            this.setWidth(availableWidth);
            
            var offset = this.margin.clone().add( this.padding );
            var widthLeft = availableWidth - offset.horizontalSum();
            
            for( var i = 0; i < this.content.length; i++ ) {
                var col = this.content[i];
                var thisWidth = widthLeft / ( this.content.length - i );
                thisWidth = (col.fixedWidth
                    ? Math.min(thisWidth, col.fixedWidth)
                    : thisWidth);
                col.splitToWidth(thisWidth);
                widthLeft -= thisWidth;
            }
            return this;
        };
    
        this.splitToHeight = function( availableSpace, nextPageSpace ) {
            var orig = availableSpace.clone();
            if ( this.getHeight() > availableSpace.getHeight() ) {
                if ( this.overflowAction === "split" || Math.abs(nextPageSpace.getHeight() - availableSpace.getHeight()) < 0.5){
                    var result = { 
                        status   : (this.overflowAction === "split" ? "split" : "forcedSplit" ),
                        toAdd    : this.clone().setContent([]),
                        overflow : this.clone().setContent([])
                    };
                    availableSpace.offset( { y1: this.getHeightWithoutContent()});
                    nextPageSpace.offset( {y1: this.getHeightWithoutContent()});
                    for( var i = 0; i < this.content.length; ++i ){
                        var nestedResult = this.content[i].splitToHeight( availableSpace.clone(), nextPageSpace.clone() );
                        if ( nestedResult.status === "newPage"){
                            return { status: "newPage", overflow: this };
                        }
    
                        result.toAdd.addContent( nestedResult.toAdd );
                        var overflow = nestedResult.overflow || nestedResult.toAdd;
                        
                        if ( nestedResult.status === "normal" ){
                            var lastEl = overflow;
                            while( this.isPDFSection(lastEl) && lastEl.content.length > 0 && this.isPDFSection( _.last(lastEl.content) ) ){
                                lastEl.content = _.takeRight(lastEl.content, 1);
                                lastEl = lastEl.content[0];
                            }
                        }
                        result.overflow.addContent( overflow ); 

                    }
                    if ( result.toAdd.getHeight() > orig.getHeight())
                        throw "";
                    return result;
                }
                else return { status: "newPage", overflow: this };
            }
            console.log("NORMAL");
            console.log(this.getHeight());
            console.log(availableSpace.getHeight());
            return { status: "normal", toAdd: this.clone() };
        };
    
        this.render = function(renderSpace){
            var drawDim = renderSpace.clone().offset(this.margin),
                styles  = this.getStyles();
            this.renderBorderAndFill(drawDim);
    
            drawDim.offset( this.padding );
            this.setStyles( styles );
    
            if ( this.isPDFSection( this.Header ) ){
                var headerSpace = drawDim.clone().setHeight( this.Header.getHeight());
                this.Header.render( headerSpace );
                drawDim.offset( { y1: this.Header.getHeight() } );
            }
            if ( this.isPDFSection( this.Footer ) ){
                var footerSpace = drawDim.clone().setHeight( this.Footer.getHeight());
                this.Footer.render( footerSpace );
                drawDim.offset( { y2: this.Footer.getHeight() } );
            }
            _.forEach(this.content, function(section){
                var sectionSpace = drawDim.clone().setWidth(section.getWidth());
                section.render( sectionSpace );
                drawDim.offset( { x1: section.getWidth() });
            }.bind(this));
            return this;
        };
        return this;
    }).call( Object.create( PDFSection.prototype ));
    

    // Derived Type ColumnSection
    ColumnSection = function( settings, globalSettings ) {
        settings = settings || {};
        this.padding = new Offset( settings.padding || { all: 5 });
        PDFSection.call( this, settings, globalSettings );
        this.constructor = ColumnSection;
        return this;
    };
    ColumnSection.prototype = Object.create(PDFSection.prototype);

    // Derived Type PDFPage
    function PDFPage( settings ) {
        settings = settings || {};
        PDFSection.call( this, settings );
        setProperties.call(this, {
            documentSpace: settings.documentSpace.clone(),
            pageSpace    : settings.pageSpace.clone(),
            contentSpace : settings.contentSpace.clone(),
            pageFormat   : settings.pageFormat
        });
        this.constructor = PDFPage;
        return this;
    }
    PDFPage.prototype = Object.create(PDFSection.prototype);

    // Derived Type PDFDocument
    PDFDocument = function ( settings, globalSettings ) {
        settings = settings || {};
        if ( settings.globalSettings ){
            this.globalSettings = settings.globalSettings || globalSettings || {};
        }
        
        PDFSection.call( this, settings );
        
        setProperties.call(this, {
            currentPage   : null,
            pages         : [],
            documentSpace : new Dimensions( settings.documentSpace || { width : 612, height : 792 }),
            pageSpace     : new Dimensions( settings.documentSpace || { width : 612, height : 792 }),
            contentSpace  : new Dimensions( settings.documentSpace || { width : 612, height : 792 }),
            pageFormat    : settings.pageFormat || "portrait",
            PDFName       : settings.PDFName || "PDF"
        });
        this.constructor = PDFDocument;
        return this;
    };

    PDFDocument.prototype = (function() {
        this.addPage = function(){
            if ( this.currentPage !== null ){
                this.pages.push( this.currentPage.clone().setHeader(this.Header).setFooter(this.Footer) );
            }
            this.currentPage = new PDFPage(this)
            .setHeader(this.Header)
            .setFooter(this.Footer)
            .setContent([]);
            return this.currentPage;
        };
        this.render = function(){
            PDF = new jsPDF('portrait', 'pt', 'letter');
            for ( var i = 0; i < this.pages.length; i++){
                var page = this.pages[i];
                page.render(page.documentSpace.clone());
                if ( i !== this.pages.length - 1){
                    PDF.addPage();
                }
            }
            return this;
        };

        this.save = function(fileName){
            fileName = fileName || "document.pdf";
            this.render();
            PDF.save(fileName);
        };
    
        this.uri = function(){
            this.render();
            return PDF.output("datauristring");
        };
    
        this.newWindow = function(){
            this.render();
            PDF.output("datauri");
        };
    
    
        this.initialize = function() {
            this.pageSpace = this.documentSpace.clone().offset( this.margin );
            var width = this.pageSpace.clone().offset(this.padding).getWidth();
            if ( this.Header ) {
                this.Header.splitToWidth(width);
            }
            if ( this.Footer ) {
                this.Footer.splitToWidth(width);
            }
            this.contentSpace = this.pageSpace.clone().offset({ top: this.getHeaderHeight(), bottom: this.getFooterHeight() });
            this.addPage();
            _.forEach(this.content, function(section){
                section.splitToWidth(width);
            });
    
            _.forEach(this.content, function(section){
                var page = this.currentPage;
                var result = section.splitToHeight(page.contentSpace.clone(), page.pageSpace.clone());
                if ( result.status !== "newPage" && result.toAdd.getHeight() > page.contentSpace.getHeight())
                    throw "Over page bounds";
                console.log(result.status);
                console.log(result);
                while ( result.status !== "normal" ) {
                    console.log(result);
                    console.log(page.contentSpace.getHeight());
                    if ( result === "split" || result === "forcedSplit"){
                        page.addContent( result.toAdd );
                        page.contentSpace.offset( { y1: result.toAdd.getHeight() });
                    }
                    // Executes for both "split" and "newPage" results
                    page = this.addPage();
                    result = result.overflow.splitToHeight( page.contentSpace, page.pageSpace );
                }
                if ( result.status === "normal"){
                    
                    console.log(result);
                    console.log(page.contentSpace.getHeight());
                    this.currentPage.addContent( result.toAdd );
                    page.contentSpace.offset( { y1: result.toAdd.getHeight() });
                }
            }.bind(this));
            if( this.currentPage.content.length > 0)
                this.addPage();
            return this;
        };
        
        return this;
    }).call( Object.create( PDFSection.prototype ));


    
//}());

function Offset( _offset, _right, _bottom, _left ) {
    this.set = function(offset, right, bottom, left){
        if ( _.isObject( offset ) ) {
            if ( _.has( offset, "all" ) ){
                return this.set(offset.all, offset.all, offset.all, offset.all);
            }
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
    }.bind(this);

    this.set(_offset, _right, _bottom, _left);

    this.clone = function(){
        return new Offset(this);
    }.bind(this);

    this.add = function( offset, right, bottom, left ) {
        if ( _.isObject( offset ) ) {
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
    }.bind(this);

    this.negate = function(flags, negRight, negbottom, negleft) {
        if( _.isUndefined(flags) ){
            flags = { top:true, bottom:true, left:true, right:true };
        }
        if ( _.isObject( flags ) ) {
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

    this.verticalSum = function(){
        return this.top + this.bottom;
    }.bind(this);

    this.horizontalSum = function(){
        return this.left + this.right;
    }.bind(this);
}

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
        if ( _.isNumber( width ) ) { 
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
        if ( _.isNumber( height ) ) { 
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

        if ( _.isNumber(_dim) && _.isUndefined(x2) 
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
}

var report = new PDFDocument({
    reportTitle: 'Hi',
    FillColor: [100, 100, 240],
    Border: true,
    margin: { all: 50 }, 
    inheritedSettings: {
        linePadding: { top: -2, left: 5, bottom: 5, right: 5 }
    }
})
.setHeader({type: 'text', content: 'HEADER'})
.setFooter({type: 'text', content: 'FOOTER', offsetFromBottom: true });
var row = new RowSection().addContent(
        [   new TextSection({ padding: {top:100} }, report).addContent( 'Line 1 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 2 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 3 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 4 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 5 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 6 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 7 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 8 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 9 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 10 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 11 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 12 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 13 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 14 ----------------------------------------------------------' )
    ]);
var t = new TextSection({ padding: {top:100} }, report).addContent( "adsfgfdjhku dsja  asdfjfdsap'saodf p'asodf psad'o fsap'do gfd,m lkgfdsj lkjfdgs;lk jdfsgl;kdsfjg dl;fsk" );
report.addContent( [ row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),row.clone(),row.clone(),t.clone(),row.clone(),t.clone(),t.clone()]
    )
.initialize();
var URI = false;
URI = report.uri();
setURI();
function setURI(){
    if(URI === false || $("iframe").length < 1){
        setTimeout(setURI, 100);
    }
    else {
        $("iframe").attr("src", URI);
    }
}

