"use strict";

var RowSection, TextSection, ColumnSection, PDFDocument;
( function() {

    // A shared static variable
    var PDF = new jsPDF('portrait', 'pt', 'letter');

    // Convenience function to set properties in constructor
    function setProperties ( mappedVals ) {
        _.forEach ( _.keys( mappedVals ), function ( prop ) {
            this [ prop ] = mappedVals [ prop ];
        }.bind(this));
        return this;
    }

    // Check if an object is a PDFSection
    function isPDFSection( section ) {
        return _.isObject( section ) && section.baseClass === PDFSection;
    }

    // Check what type content is before constructing it.
    function getContentType( content ) {
        var isArray = _.isArray( content )
            ? "array"
            : false;
        return isArray || content.type || typeof content;
    }

    // Wipe content and add to a PDFSection
    function setContent( content ){
        this.content = [];
        return this.addContent(content);
    }

    // Add content to a PDFSection
    function addContent( content ) {
        this.content = this.content || [];
        // If the content is not already a PDFSection, construct the appropriate section
        if ( !( isPDFSection(content) )) {
            var type = getContentType( content );
            switch ( type )  {
                case 'array' : _.forEach( content, addContent.bind ( this ) ); return this;
                case 'text'  : content = new TextSection  ( content );  break;
                case 'row'   : content = new RowSection   ( content );  break;
                case 'column': // Falls through
                case 'col'   : content = new ColumnSection( content );  break;
            }
        }
        if ( isPDFSection(content) )
            this.content.push( content.clone(this.cloneSettings()));
        return this;
    }

    // Set either the header or footer of a PDFSection
    function setHeaderFooter(name, headerOrFooter) {
        if( _.isUndefined(headerOrFooter))
            return this;
        if ( isPDFSection ( headerOrFooter ) )
            this[ name ]  = headerOrFooter;
        else 
            this[ name ]  = new RowSection ( headerOrFooter );

        if( _.isString( headerOrFooter.content ) )
            this[ name ].setContent( new TextSection(this[ name ].cloneSettings()).setContent(headerOrFooter.content ));
        return this;
    }

    /* PDF Section base constructor:
        A common class between the PDFSection classes and the Textwrapper class
    */
    function PDFBase( settings, globalSettings ){
        var s  = settings       || {};
        var gs = globalSettings || {};
        return setProperties.call(this, {
            fixedWidth  :             s.fixedWidth   || null,
            width       :             s.fixedWidth   || null,
            Font        :             s.Font         || gs.Font         || 'courier',
            FontSize    :             s.FontSize     || gs.FontSize     || 10,
            DrawColor   :             s.DrawColor    || gs.DrawColor    || [100, 100, 240],
            linePadding : new Offset (s.linePadding  || gs.linePadding  || { all: 0 } ),
            getStyles   : function(){
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
            }.bind(this),
            clone : function(globalSettings){ 
                var instance = new this.constructor(this, globalSettings);
                instance.setHeader(this.Header);
                instance.setFooter(this.Footer);
                return instance;
            },
            overflowAction : "split",
            constructor : PDFBase,
            baseClass   : PDFBase  // This is overridden for the PDFSection classes, but not the TextWrapper
        });
    }
    PDFBase.prototype.setStyles = function(styles){
        _.forEach(_.keys(styles), function(key){
            PDF[key].apply(PDF, styles[key] );
        }.bind(this));
    };
    PDFBase.prototype.cloneSettings = function (){
        return {
            Font        : this.Font,
            FontSize    : this.FontSize,
            DrawColor   : _.clone(this.DrawColor),
            linePadding : new Offset(this.linePadding || { all: 0 })
        };
    };


    // PDFSection base constructor
    function PDFSection( settings, globalSettings ) {
        var s  = settings       || {};
        var gs = globalSettings || {};
        PDFBase.call(this, s, gs);
        
        return setProperties.call(this, {
            Border          : s.Border         || gs.Border         || true,
            content         : s.content   || [],
            //FillColor       : s.FillColor      || gs.FillColor      || [100, 100, 240],
            margin          : new Offset ( s.margin  || { all: 0 }),
            overflowAction  : s.overflowAction || gs.overflowAction || "split",
            padding         : new Offset ( s.padding || { all: 0 }),
            
            getHeaderHeight : function(){
                return ( isPDFSection(this.Header)? this.Header.getHeight() : 0 );
            }.bind(this),
            getFooterHeight : function(){
                return ( isPDFSection(this.Footer)? this.Footer.getHeight() : 0 );
            }.bind(this),
            getHeaderFooterHeight : function(){
                return this.getHeaderHeight() + this.getFooterHeight();
            }.bind(this),
            getHeightWithoutContent : function(){
                var offset = this.margin.clone().add( this.padding );
                return this.getHeaderFooterHeight() + offset.verticalSum();
            }.bind(this),
            getBorderStyles   : function(){
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
            }.bind(this),
            setContent      : setContent.bind ( this ),
            setFooter       : setHeaderFooter.bind ( this, "Footer" ),
            setHeader       : setHeaderFooter.bind ( this, "Header" ),
            constructor : PDFSection,
            baseClass   : PDFSection
        });
    }
    PDFSection.prototype = Object.create(PDFBase.prototype);
    PDFSection.prototype.addContent = function(content){
        return addContent.call( this, content );
    };

    PDFSection.prototype.cloneSettings = function (){
        var settings = {
            Border            : this.Border,
            overflowAction    : this.overflowAction,
            padding           : new Offset(this.padding || { all: 0 })
        };
        _.defaults(settings, PDFBase.prototype.cloneSettings.call(this));
        return settings;
    };

    PDFSection.prototype.getHeight = function(){
        var height = 0 + this.getHeightWithoutContent();
        _.forEach( this.content, function(section) {
            height += section.getHeight();
        }.bind(this));
        return height;
    };

    PDFSection.prototype.splitToWidth = function( availableWidth ){
        if ( _.isNumber( this.fixedWidth ) ){
            availableWidth = Math.min( this.fixedWidth, availableWidth );
        }
        console.log("WIDTH");
        console.log(availableWidth);
        console.log(this);
        if ( _.isUndefined(availableWidth)){
            throw "ERROR, no width given";
        }
        this.width = availableWidth;
        var offset = this.margin.clone().add( this.padding );
        var maxWidth = availableWidth - offset.horizontalSum();
        for ( var i = 0; i < this.content.length; i++){
            this.content[i].splitToWidth(maxWidth);
        }
        return this;
    };

    PDFSection.prototype.splitToHeight = function( availableSpace, nextPageSpace ) {
        var baseHeight = this.getHeightWithoutContent();
        if ( this.getHeight() > availableSpace.h() ) {
            var noPadding = this.getHeight() - this.padding.verticalSum();
            if ( this.overflowAction === "split" && noPadding < availableSpace.h()) {
                console.log( "Padding Split");
                var diff = availableSpace.h() - noPadding;
                console.log(availableSpace.h());
                console.log(this.getHeight());
                console.log(this.padding.verticalSum());
                console.log(diff);
                this.padding.top = diff / 2;
                this.padding.bottom = diff / 2;
                return { status: "normal", toAdd: this };
            }
            else if ( baseHeight > availableSpace.h() || 
                (baseHeight + ( PDF.getLineHeight() * 3) > availableSpace.h())) {
                console.log("base height too large");
                return { status: "newPage", overflow: this };
            }
            var search = this;
            while( search.content && search.content.length < 2){
                if( search.content.length === 0 || _.isString(search.content[0])){
                    console.log("single nested");
                    return  { status: "newPage", overflow: this };
                }
                else if( search.content.length === 1 ){
                    search = search.content[0];
                }
            }
            if ( this.overflowAction === "split" || Math.abs(nextPageSpace.h() - availableSpace.h()) < 0.5){
                var result = { status: (this.overflowAction === "split" ? "split" : "forcedSplit" ) };
                var usedHeight = this.getHeightWithoutContent();
                nextPageSpace.offset( { y1: 0 - this.getHeightWithoutContent()});
                var i = 0; 
                while ( this.content[i].getHeight() + usedHeight < availableSpace.h()){
                    availableSpace.offset( { y1: 0 - this.content[ i ].getHeight()});
                    ++i;
                }
                var nestedResult = this.content[i].splitToHeight(availableSpace.clone(), nextPageSpace.clone());

                result.toAdd = this.clone()
                      .setContent( _.take(this.content, i))
                      .addContent( nestedResult.toAdd );

                result.overflow = this.clone()
                      .setContent( nestedResult.overflow )
                      .addContent( _.drop(this.content, i + 1));
                      
                return result;
            }
            else return { status: "newPage", overflow: this };
        }
        else return { status: "normal", toAdd: this };
    };

    PDFSection.prototype.renderBorderAndFill = function(renderSpace){
        var drawDim   = renderSpace.clone();
        var hasFill   = _.has(this, "FillColor");
        var hasBorder = _.has(this, "Border");
        var borderStyles = this.getBorderStyles();
        if ( hasFill || hasBorder ){
            this.setStyles( borderStyles );
            var x1 = drawDim.x1, 
                y1 = drawDim.y1, 
                width = drawDim.w(), 
                height = drawDim.h();
            if ( hasFill && hasBorder )
                PDF.rect( x1, y1, width, height, "FD");
            else if ( hasFill )
                PDF.rect( x1, y1, width, height, "F");
            else  // hasBorder
                PDF.rect( x1, y1, width, height );
        }
        return this;
    };

    PDFSection.prototype.render = function(renderSpace){
        var drawDim = renderSpace.clone().offset(this.margin),
            styles  = this.getStyles();
        this.renderBorderAndFill(drawDim);

        drawDim.offset( this.padding );
        this.setStyles( styles );
 
        if ( isPDFSection( this.Header ) ){
            var headerSpace = drawDim.clone().height( this.Header.getHeight());
            this.Header.render( headerSpace );
            drawDim.offset( { y1: this.Header.getHeight() } );
        }
        if ( isPDFSection( this.Footer ) ){
            console.log("Rendering Footer");
            var footerSpace = drawDim.clone().height( this.Footer.getHeight(), true);
            this.Footer.render( footerSpace );
            drawDim.offset( { y2: this.Footer.getHeight() } );
        }
        _.forEach(this.content, function(section){
            var sectionSpace = drawDim.clone().height( section.getHeight());
            section.render( sectionSpace );
            drawDim.offset( { y1: section.getHeight() });
        }.bind(this));
        return this;
    };



    // Wraps text for TextSection class ( this was to make the TextSection class more similar to the other PDFSection classes )
    function TextWrapper(settings, globalSettings){
        PDFBase.call(this, settings, globalSettings);
        return setProperties.call(this, {
            content     : settings.content || [],
            constructor : TextWrapper
        });
    }
    TextWrapper.prototype = Object.create(PDFBase.prototype);

    TextWrapper.prototype.setContent = function(content){
        this.content = content;
        return this;
    };
    TextWrapper.prototype.getHeightWithoutContent = function(){
        var sum = 0;
        sum += Math.max( this.linePadding.top, 0);
        sum += Math.max( this.linePadding.bottom, 0);
        return sum;
    };
    TextWrapper.prototype.getHeight = function(){
        return this.content.length * PDF.getLineHeight();
    };
    TextWrapper.prototype.splitToWidth = function( availableWidth  ){
        this.width = availableWidth;
        var maxWidth = availableWidth - ( Math.max( this.linePadding.left, 0) + Math.max(this.linePadding.right, 0));
        this.content = PDF.splitTextToSize( this.content, maxWidth, {
            FontSize : this.FontSize,
            FontName : this.Font
        });
        return this;
    };
    TextWrapper.prototype.splitToHeight = function( availableSpace ) {
        var maxIndex = Math.ceil( availableSpace.h() / PDF.getLineHeight() ) - 1;
        if ( maxIndex <= this.content.length ) { 
            return { status: "normal", toAdd: this }; 
        }
        return { 
            status   : "split",
            toAdd    : this.clone().setContent( _.take( this.content, maxIndex)),
            overflow : this.clone().setContent( _.drop( this.content, maxIndex)) 
        };
    };
    TextWrapper.prototype.render = function(renderSpace){
        var drawDim   = renderSpace.clone(),
        styles        = this.getStyles();

        drawDim.offset({ x1: this.linePadding.left, x2: this.linePadding.right });
        this.setStyles( styles );
        drawDim.offset({ y1: this.linePadding.top + PDF.getLineHeight()});
        if ( _.isArray(this.content)){
            _.forEach(this.content, function(line){
                PDF.text(drawDim.x1, drawDim.y1, line);
                drawDim.offset({ y1: Math.max(this.linePadding.top, 0) + PDF.getLineHeight()});
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
    
    // Derived PDFSection Type for containing text
    TextSection = function( settings, globalSettings ) {
        PDFSection.call( this, settings, globalSettings );
        this.constructor = TextSection;
        return this;
    };
    TextSection.prototype = Object.create(PDFSection.prototype);
    TextSection.prototype.getHeight = function( ){
        var height = this.getHeightWithoutContent();
        _.forEach ( this.content, function() {
            height += PDF.getLineHeight();
        }.bind(this));
        return height;
    };
    TextSection.prototype.splitToWidth = function( availableWidth ){
        return PDFSection.prototype.splitToWidth.call(this, availableWidth);
    };
    TextSection.prototype.splitToHeight = function( availableHeight, nextPageHeight ) {
        return PDFSection.prototype.splitToHeight.call(this, availableHeight, nextPageHeight);
    };
    TextSection.prototype.addContent = function(content){
        if ( _.isArray( content ) && content.length > 0 ){
            var allString = true;
            _.forEach( content, function(line){
                allString = ( allString? _.isString( line ) : false );
            });
            content = allString
                ? content.join("\n")
                : "";
        }
        if ( _.isString( content )){
            this.content.push(new TextWrapper(this).setContent(content));
        }
        return this;
    };


    // Derived Type RowSection
    RowSection = function( settings ) {
        settings = settings || {};
        settings.padding = settings.padding || new Offset({ all: 0 });
        PDFSection.call ( this, settings );
        this.constructor = RowSection;
        return this;
    };
    RowSection.prototype = Object.create(PDFSection.prototype);
    RowSection.prototype.addContent = function(content){
        return addContent.call( this, content );
    };
    RowSection.prototype.getHeight = function( ){
        var height = 0;
        _.forEach ( this.content, function(col) {
            height = Math.max( col.getHeight(), height);
        }.bind(this));
        return height + this.getHeightWithoutContent();
    };

    RowSection.prototype.splitToWidth = function(availableWidth){
        if ( _.isNumber( this.fixedWidth ) ){
            availableWidth = Math.min( this.fixedWidth, availableWidth );
        }
        this.width = availableWidth;
        
        var offset = this.margin.clone().add( this.padding );
        var widthLeft = availableWidth - offset.horizontalSum();
        
        for( var i = 0; i < this.content.length; i++ ) {
            var col = this.content[i];
            var thisWidth = widthLeft / ( this.content.length - i );
            thisWidth = (col.fixedWidth
                ? Math.min(thisWidth, col.fixedWidth)
                : thisWidth);
            col.splitToWidth(thisWidth);
            if( _.isNumber( col.fixedWidth )){
                widthLeft -= thisWidth;
            }
        }
        return this;
    };

    RowSection.prototype.splitToHeight = function( availableSpace, nextPageSpace ) {
        if ( this.getHeight() > availableSpace.h() ) {
            if ( this.overflowAction === "split" || Math.abs(nextPageSpace.h() - availableSpace.h()) < 0.5){
                var result = { 
                    status   : (this.overflowAction === "split" ? "split" : "forcedSplit" ),
                    toAdd    : this.clone().setContent([]),
                    overflow : this.clone().setContent([])
                };
                availableHeight = availableSpace.h() - this.getHeightWithoutContent();
                nextPageHeight -= this.getHeightWithoutContent();
                for( var i = 0; i < this.content.length; ++i ){
                    var nestedResult = this.content[i].splitToHeight( availableSpace.clone(), nextPageSpace.clone() );
                    if ( nestedResult.status === "newPage" && result.status !== "forcedSplit") {
                        return { result: "newPage", overflow: this };
                    }

                    result.toAdd.addContent( nestedResult.toAdd );
                    var overflow = nestedResult.overflow || nestedResult.toAdd.content;
                    
                    if ( nestedResult.status === "normal" ){
                        var lastEl = overflow;
                        while( lastEl.content.length > 0 && isPDFSection( _.last(lastEl.content) ) ){
                            lastEl.content = _.takeRight(lastEl.content, 1);
                            lastEl = lastEl.content[0];
                        }
                    }
                    result.overflow.addContent( overflow ); 
                }
                return result;
            }
        }
        return { status: "normal", toAdd: this.clone() };
    };

    RowSection.prototype.render = function(renderSpace){
        var drawDim = renderSpace.clone().offset(this.margin),
            styles  = this.getStyles();
        this.renderBorderAndFill(drawDim);

        drawDim.offset( this.padding );
        this.setStyles( styles );
 
        if ( isPDFSection( this.Header ) ){
            var headerSpace = drawDim.clone().height( this.Header.getHeight());
            this.Header.render( headerSpace );
            drawDim.offset( { y1: this.Header.getHeight() } );
        }
        if ( isPDFSection( this.Footer ) ){
            var footerSpace = drawDim.clone().height( this.Footer.getHeight());
            this.Footer.render( footerSpace );
            drawDim.offset( { y2: this.Footer.getHeight() } );
        }
        _.forEach(this.content, function(section){
            var sectionSpace = drawDim.clone().width( section.width);
            section.render( sectionSpace );
            drawDim.offset( { x1: section.width });
        }.bind(this));
        return this;
    };

    // Derived Type ColumnSection
    ColumnSection = function( settings, globalSettings ) {
        settings = settings || {};
        this.padding = new Offset( settings.padding || { all: 5 });
        PDFSection.call( this, settings, globalSettings );
        this.constructor = ColumnSection;
        return this;
    };
    ColumnSection.prototype = Object.create(PDFSection.prototype);

    ColumnSection.prototype.addContent = function(content){
        return addContent.call( this, content );
    };
    ColumnSection.prototype.getHeight = function( ){
        return PDFSection.prototype.getHeight.call(this);
    };
    ColumnSection.prototype.splitToWidth  = function( availableWidth ){
        return PDFSection.prototype.splitToWidth.call(this, availableWidth);
    };
    ColumnSection.prototype.splitToHeight = function( availableSpace, nextPageSpace ) {
        return PDFSection.prototype.splitToHeight.call(this, availableSpace, nextPageSpace);
    };

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
    PDFPage.prototype.addContent = function(content){
        return addContent.call( this, content );
    };
    PDFPage.prototype.getHeight = function( ){
        return PDFSection.prototype.getHeight.call(this);
    };

    // Derived Type PDFDocument
    PDFDocument = function ( settings ) {
        settings = settings || {};
        PDFSection.call( this, settings );
        setProperties.call(this, {
            currentPage   : null,
            pages         : [],
            documentSpace : new Dimensions( settings.documentSpace || { width : 612, height : 792 }),
            pageSpace     : new Dimensions( settings.documentSpace || { width : 612, height : 792 }),
            contentSpace  : new Dimensions( settings.documentSpace || { width : 612, height : 792 }),
            pageFormat    : settings.pageFormat || "portrait",
            PDFName       : settings.PDFName || "PDF",
            addPage       : function(){
                                if ( this.currentPage !== null ){
                                    this.pages.push( this.currentPage.clone().setHeader(this.Header).setFooter(this.Footer) );
                                }
                                this.currentPage = new PDFPage(this)
                                .setHeader(this.Header)
                                .setFooter(this.Footer)
                                .setContent([]);
                                return this.currentPage;
                            }.bind(this)
        });
        this.constructor = PDFDocument;
        return this;
    };
    PDFDocument.prototype = Object.create(PDFSection.prototype);

    PDFDocument.prototype.addContent = function(content){
        return addContent.call( this, content );
    };
    PDFDocument.prototype.getHeight = function( ){
        return PDFSection.prototype.getHeight.call(this);
    };

    PDFDocument.prototype.render = function(){
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

    PDFDocument.prototype.save = function(fileName){
        fileName = fileName || "document.pdf";
        this.render();
        PDF.save(fileName);
    };

    PDFDocument.prototype.uri = function(){
        this.render();
        return PDF.output("datauristring");
    };

    PDFDocument.prototype.newWindow = function(){
        this.render();
        PDF.output("datauri");
    };


    PDFDocument.prototype.initialize = function() {
        this.pageSpace = this.documentSpace.clone().offset( this.margin );
        var width = this.pageSpace.clone().offset(this.padding).width();
        if ( this.Header ) {
            this.Header = new RowSection(this.Header, this.cloneSettings());
            this.Header.splitToWidth(width);
        }
        if ( this.Footer ) {
            this.Footer = new RowSection(this.Footer, this.cloneSettings());
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
            console.log(result.status);
            console.log(result);
            while ( result.status !== "normal" ) {
                //throw "";
                console.log(result);
                console.log(page.contentSpace.height());
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
                console.log(page.contentSpace.height());
                this.currentPage.addContent( result.toAdd );
                page.contentSpace.offset( { y1: result.toAdd.getHeight() });
            }
        }.bind(this));
        if( this.currentPage.content.length > 0)
            this.addPage();
        return this;
    };
}());

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

    this.width = function( width, adjustLeftCoordinate ) {
        if ( _.isNumber( width ) ) { 
            if ( adjustLeftCoordinate === true ) { this.x1 = this.x2 - width; }
            else { this.x2 = this.x1 + width; }
            return this;
        }
        else {
            return this.x2 - this.x1;
        }
    }.bind( this );

    this.w = this.width;

    this.height = function( height, adjustTopCoordinate ) {
        if ( _.isNumber( height ) ) { 
            if ( adjustTopCoordinate === true ) { this.y1 = this.y2 - height; }
            else { this.y2 = this.y1 + height; }
            return this;
        }
        else {
            return this.y2 - this.y1;
        }
    }.bind( this );

    this.h = this.height;

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
    linePadding: { top: -2, left: 0, bottom: 0, right: 0 }
})
.setHeader({type: 'text', content: 'HEADER'})
.setFooter({type: 'text', content: 'FOOTER', offsetFromBottom: true });
report.addContent(
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
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 14 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 15 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 16 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 17 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 18 ----------------------------------------------------------' ),
            new TextSection({ padding: {top:100} }, report).addContent( 'Line 19 ----------------------------------------------------------' )
    ])
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