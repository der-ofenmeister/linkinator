"use strict";
var invalidUrlError = require("./invalidUrlError");

var urllib = require("url");
var urlobj = require("urlobj");



function linkObj(url)
{
	return {
		url:
		{
			original: (typeof url === "string") ? url : null,
			resolved: null,
			redirected: null,
			
			// temp keys
			parsed: null
		},
		
		base:
		{
			original: null,
			resolved: null,
			
			// temp keys
			parsed: null
		},
		
		html:
		{
			index: null,
			selector: null,
			tagName: null,
			attrName: null,
			attrs: null,
			text: null,
			tag: null,
			
			// temp keys
			attrMap: null,
			base: null,
			selfClosing: null,
			voidElement: null
		},
		
		http:
		{
			statusCode: null,
			redirects: null,
			response: null
		},
		
		broken: null,
		internal: null,
		samePage: null,
		error: null,
		
		// temp keys
		broken_link_checker: true,
		resolved: false
	};
}



/*
	Set a link as broken.
*/
linkObj.broken = function(link, error)
{
	link.broken = true;
	link.error = invalidUrlError(error);
	
	return link;
};



/*
	Remove unnecessary keys for public use.
*/
linkObj.clean = function(link)
{
	// No further need for array syntax
	link.html.attrs = link.html.attrMap;
	
	delete link.base.parsed;
	delete link.broken_link_checker;
	delete link.html.attrMap;
	delete link.html.base;  // TODO :: don't clean this? just set to null if it'd been set to undefined?
	delete link.html.selfClosing;
	delete link.html.voidElement;
	delete link.resolved;
	delete link.url.parsed;
	
	return link;
};



/*
	Define relationships with base URL.
*/
linkObj.relation = function(link, url_parsed)
{
	if (url_parsed === undefined) url_parsed = link.url.parsed;
	else if (typeof url_parsed === "string") url_parsed = urlobj.parse(url_parsed);
	
	var relation;
	
	// If no protocols, it's impossible to determine if they link to the same server
	if (url_parsed.protocol===null || link.base.parsed.protocol===null)
	{
		// Overwrite any previous values
		link.internal = null;
		link.samePage = null;
	}
	else
	{
		// Resolved base not used because html base could be remote
		relation = urlobj.relation(url_parsed, link.base.parsed);
		
		link.internal = relation >= urlobj.component.AUTH;
		link.samePage = link.internal===true && relation>=urlobj.component.PATH;
	}
	
	return link;
};



/*
	Absolute'ize a link based on its base URL and HTML's <base>.
*/
// TODO :: make similar to `url.resolve(from,to)` ?
linkObj.resolve = function(link, base, options)
{
	// If already resolved
	if (link.resolved === true) return;
	
	// Parity with core `url.resolve()`
	var parseOptions = { slashesDenoteHost:true };
	
	
	
	// TODO :: we're constantly re-parsing base and html base -- find way to cache them
	var base_parsed = base==null ? "" : base;
	base_parsed = urlobj.normalize( urlobj.parse(base_parsed, parseOptions) );
	
	var htmlBase_parsed = link.html.base==null ? "" : link.html.base;
	htmlBase_parsed = urlobj.normalize( urlobj.parse(htmlBase_parsed, parseOptions) );
	
	// TODO :: options.normalize=false
	// TODO :: options.clone=true ?
	var resolvedBase_parsed = urlobj.resolve(base_parsed, htmlBase_parsed);
	
	if (resolvedBase_parsed.hash !== null)
	{
		// Hashes are useless in a base
		resolvedBase_parsed.hash = null;
		resolvedBase_parsed.href = urllib.format(resolvedBase_parsed);  // TODO :: use urlobj.format() when available
	}
	
	// TODO :: is this necessary if `link.base.parsed` is cleaned?
	if (base_parsed.hash !== null)
	{
		// Hashes are useless in a base
		base_parsed.hash = null;
		base_parsed.href = urllib.format(base_parsed);  // TODO :: use urlobj.format() when available
	}
	
	
	
	// `link.url.original` should only ever not have a value within internal tests
	var linkOrg_parsed = link.url.original==null ? "" : link.url.original;
	linkOrg_parsed = urlobj.parse(linkOrg_parsed, parseOptions);
	
	// `linkOrg_parsed` is cloned to avoid it being mutated
	// TODO :: options.clone=true
	var resolvedUrl_parsed = urlobj.resolve( resolvedBase_parsed, cloneObject(linkOrg_parsed) );
	
	
	
	if (base !== undefined)
	{
		link.base.original = base;
	}
	
	// TODO :: use url types (>UNKNOWN && !=EMPTY ... not simple enough)
	if (resolvedBase_parsed.href !== "")
	{
		link.base.resolved = parity(resolvedBase_parsed.href);
	}
	
	link.base.parsed = base_parsed;
	
	// If resolved link has accepted scheme
	if (options.acceptedSchemes[ resolvedUrl_parsed.extra.protocolTruncated ] === true)
	{
		link.url.resolved = parity(resolvedUrl_parsed.href);
		link.url.parsed   = resolvedUrl_parsed;
		
		// TODO :: move relation stuff out of this function -- separation of concerns?
		linkObj.relation(link);
	}
	// Else could not be properly resolved
	else
	{
		link.url.parsed = linkOrg_parsed;
		
		// If at least resolved to absolute
		if (resolvedUrl_parsed.extra.type === urlobj.type.ABSOLUTE)
		{
			// If base is accepted scheme
			if (options.acceptedSchemes[ base_parsed.extra.protocolTruncated ] === true)
			{
				link.internal = false;
				link.samePage = false;
			}
		}
	}
	
	
	
	// Avoid future resolving
	link.resolved = true;
	
	return link;
};



//::: PRIVATE FUNCTIONS



/*
	Clones an object and its prototype while maintaining enumerable
	keys and support for `instanceof`.
*/
// TODO :: this may not be necessary if linkObj.base.parsed and linkObj.url.parsed are cleaned out
// TODO :: move this into urlobj
function cloneObject(source)
{
	var key,value;
	var clone = Object.create(source);
	
	for (key in source)
	{
		if (source.hasOwnProperty(key) === true)
		{
			value = source[key];
			
			if (value!==null && typeof value==="object")
			{
				clone[key] = cloneObject(value);
			}
			else
			{
				clone[key] = value;
			}
		}
	}
	
	return clone;
}



/*
	Maintain parity with core `url.resolve()`.
*/
// TODO :: remove this?
function parity(url)
{
	return (url !== "http://") ? url : "http:///";
}



module.exports = linkObj;